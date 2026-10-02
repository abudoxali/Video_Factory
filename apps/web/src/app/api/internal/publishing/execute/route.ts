import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import {
  PublishExecuteRequestSchema,
  PublicationMetadataSchema,
  getPlatformLaunchStatus,
  type SocialPlatform,
} from '@video-factory/contracts';
import {
  createPublicationTransaction,
  getActiveVideoRender,
  getPublicationById,
  getRenderById,
  getSocialAccountById,
  getSocialAccountByPlatform,
  getVideoById,
} from '@video-factory/database';
import {
  buildPublishIdempotencyKey,
  drivePublication,
  emitPhaseEvent,
  resolvePhaseJob,
  type PublicationDriveResult,
} from '@/lib/orchestration';

/**
 * POST /api/internal/publishing/execute
 *
 * Real publishing boundary for n8n (VF-12 .. VF-15). Publications only reach
 * PUBLISHED through actual provider confirmation; disabled platforms are
 * skipped explicitly; missing credentials fail closed via the provider
 * factory. Deterministic idempotency keys + status-driven re-drive mean
 * retries never create duplicate social posts.
 *
 * Modes:
 *  - { publication_id, expected_platform? } — drive one existing publication
 *  - { video_id, platforms, account_ids, metadata? } — create QUEUED pubs then drive them
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = PublishExecuteRequestSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'بيانات طلب النشر غير مطابقة للمخطط',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  const body = parsed.data;

  try {
    if ('publication_id' in body) {
      // Single-publication drive (VF-13/14/15)
      const publication = await getPublicationById(body.publication_id);
      if (!publication) {
        return NextResponse.json(
          { success: false, error: 'المنشور غير موجود' },
          { status: 404 }
        );
      }
      if (body.expected_platform && publication.platform !== body.expected_platform) {
        return NextResponse.json(
          {
            success: false,
            error: `المنشور تابع لمنصة ${publication.platform} وليس ${body.expected_platform}`,
          },
          { status: 400 }
        );
      }

      const result = await drivePublication(publication);
      return NextResponse.json({
        success: result.success,
        data: { results: [result] },
      });
    }

    // Batch dispatch (VF-12)
    const video = await getVideoById(body.video_id);
    if (!video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }
    const userId = video.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'لا يمكن النشر لفيديو بلا مالك' },
        { status: 409 }
      );
    }

    const render = body.render_id
      ? await getRenderById(body.render_id)
      : await getActiveVideoRender(body.video_id);
    if (!render || render.status !== 'READY' || !render.objectKey) {
      return NextResponse.json(
        { success: false, error: 'لا يوجد إخراج READY مخزّن للنشر' },
        { status: 409 }
      );
    }

    const metadata = PublicationMetadataSchema.parse({
      title: video.title,
      ...(body.metadata || {}),
    });

    // When the caller does not enumerate platforms, every launch-enabled
    // platform is attempted — disabled ones are skipped explicitly below.
    const platforms: SocialPlatform[] =
      body.platforms && body.platforms.length > 0
        ? body.platforms
        : (['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] as SocialPlatform[]).filter(
          (p) => getPlatformLaunchStatus(p).enabled
        );

    const results: PublicationDriveResult[] = [];

    for (const platform of platforms) {
      // Disabled platforms are skipped explicitly, never silently published.
      const launch = getPlatformLaunchStatus(platform as SocialPlatform);
      if (!launch.enabled) {
        results.push({
          publicationId: '',
          platform,
          action: 'skipped',
          success: false,
          status: 'SKIPPED',
          skippedReason: 'PLATFORM_DISABLED',
          errorMessage: launch.reasonDisabled || 'المنصة معطلة في نطاق الإطلاق الحالي',
        });
        continue;
      }

      // Explicit account override wins; otherwise resolve the user's
      // connected account for the platform automatically.
      const account = body.account_ids?.[platform]
        ? await getSocialAccountById(body.account_ids[platform], userId)
        : await getSocialAccountByPlatform(userId, platform);
      if (!account || account.status !== 'CONNECTED') {
        results.push({
          publicationId: '',
          platform,
          action: 'skipped',
          success: false,
          status: 'SKIPPED',
          skippedReason: 'ACCOUNT_NOT_CONNECTED',
          errorMessage: `حساب ${platform} غير متصل أو منتهي الصلاحية`,
        });
        continue;
      }

      const idempotencyKey = buildPublishIdempotencyKey({
        userId,
        videoId: body.video_id,
        renderId: render.id,
        platform,
      });

      try {
        const { publication } = await createPublicationTransaction({
          videoId: body.video_id,
          renderId: render.id,
          socialAccountId: account.id,
          userId,
          platform,
          status: 'QUEUED',
          metadataJson: metadata as Record<string, unknown>,
          idempotencyKey,
        });

        // Duplicate → the existing record is re-driven through the same path:
        // PUBLISHED returns untouched, in-flight reconciles via getStatus.
        results.push(await drivePublication(publication));
      } catch (createErr: unknown) {
        const err = createErr as Error;
        results.push({
          publicationId: '',
          platform,
          action: 'skipped',
          success: false,
          status: 'FAILED',
          errorMessage: err.message,
        });
      }
    }

    if (body.job_id) {
      const job = await resolvePhaseJob({
        videoId: body.video_id,
        jobId: body.job_id,
        stage: 'FINISHED',
      });
      const failed = results.filter((r) => r.status === 'FAILED').length;
      await emitPhaseEvent({
        jobId: job.id,
        eventIdSuffix: `publish_dispatch_${Date.now()}`,
        event: 'publication.dispatch',
        status: failed > 0 && results.every((r) => r.status === 'FAILED' || r.status === 'SKIPPED') ? 'FAILED' : 'COMPLETED',
        stage: failed > 0 ? 'ERROR' : 'FINISHED',
        progress: 100,
        message: `نتائج توزيع النشر: ${results.length} منصة — ${failed} فاشلة`,
        metadata: { results: results.map((r) => ({ platform: r.platform, status: r.status })) },
      });
    }

    return NextResponse.json({
      success: results.some((r) => r.success),
      data: { results },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_PUBLISHING_EXECUTE_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'فشل تنفيذ النشر' },
      { status: 500 }
    );
  }
}
