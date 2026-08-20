import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  getVideoPlanDetails,
  getActiveVideoRender,
  getSocialAccountById,
  getVideoPublications,
  createPublicationTransaction,
  updatePublicationStatusTransaction,
} from '@video-factory/database';
import {
  createPublishingProvider,
  createStorageProvider,
  decryptToken,
} from '@video-factory/providers';
import {
  PublicationMetadataSchema,
  type SocialPlatform,
  getPlatformLaunchStatus,
} from '@video-factory/contracts';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const { id: videoId } = await params;
    const pubs = await getVideoPublications(videoId, user.userId);
    return NextResponse.json({
      success: true,
      data: pubs,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_GET_PUBLICATIONS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب سجل النشر' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  // Rate limit publish requests (max 10 per minute)
  const rl = checkRateLimit(`publish_${user.userId}`, { windowMs: 60000, maxRequests: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'تم تجاوز عدد طلبات النشر المسموحة، يرجى المحاولة بعد دقيقة' },
      { status: 429 }
    );
  }

  try {
    const { id: videoId } = await params;
    const body = await request.json();

    const {
      platforms = [],
      accountIds = {},
      metadata = {},
      renderId: requestedRenderId,
    } = body;

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'يرجى تحديد منصة تواصل واحدة على الأقل للنشر' },
        { status: 400 }
      );
    }

    const plan = await getVideoPlanDetails(videoId);
    if (!plan || !plan.video) {
      return NextResponse.json({ success: false, error: 'الفيديو غير موجود' }, { status: 404 });
    }

    if (plan.video.userId && plan.video.userId !== user.userId) {
      return NextResponse.json({ success: false, error: 'غير مصرح لك بنشر هذا الفيديو' }, { status: 403 });
    }

    // Resolve Active Render
    const activeRender = requestedRenderId
      ? (await getVideoPublications(videoId, user.userId)).find((p) => p.renderId === requestedRenderId)
        ? await getActiveVideoRender(videoId)
        : await getActiveVideoRender(videoId)
      : await getActiveVideoRender(videoId);

    if (!activeRender || activeRender.status !== 'READY' || !activeRender.objectKey) {
      return NextResponse.json(
        { success: false, error: 'لا يوجد فيديو مكتمل وجاهز للنشر (الحالة يجب أن تكون READY)' },
        { status: 400 }
      );
    }

    const validatedMeta = PublicationMetadataSchema.parse(metadata);
    const storage = createStorageProvider(activeRender.storageProvider || 'r2');
    const presignedVideo = await storage.getSignedReadUrl(
      activeRender.objectKey,
      7200,
      activeRender.bucket || undefined
    );

    const results = [];

    // Publish to each requested platform independently
    for (const rawPlatform of platforms) {
      const platformUpper = String(rawPlatform).toUpperCase() as SocialPlatform;

      // Validate launch scope feature flags
      const launchStatus = getPlatformLaunchStatus(platformUpper);
      if (!launchStatus.enabled) {
        results.push({
          platform: platformUpper,
          success: false,
          error: launchStatus.reasonDisabled || 'هذه المنصة غير مفعلة في نطاق الإطلاق الحالي',
        });
        continue;
      }

      const accountId = accountIds[platformUpper];

      if (!accountId) {
        results.push({
          platform: platformUpper,
          success: false,
          error: `لم يتم تحديد حساب متصل لمنصة ${platformUpper}`,
        });
        continue;
      }

      const account = await getSocialAccountById(accountId, user.userId);
      if (!account || account.status !== 'CONNECTED') {
        results.push({
          platform: platformUpper,
          success: false,
          error: `حساب ${platformUpper} غير متصل أو منتهي الصلاحية`,
        });
        continue;
      }

      // Decrypt Access Token
      let accessToken = '';
      try {
        accessToken = decryptToken(account.accessTokenEncrypted);
      } catch {
        results.push({
          platform: platformUpper,
          success: false,
          error: `فشل فك تشفير جلسة حساب ${platformUpper}`,
        });
        continue;
      }

      // Generate Idempotency Key
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${user.userId}:${videoId}:${activeRender.id}:${platformUpper}:${Date.now().toString().substring(0, 7)}`)
        .digest('hex');

      // Create publication record in DB
      const { publication, isDuplicate } = await createPublicationTransaction({
        videoId,
        renderId: activeRender.id,
        socialAccountId: account.id,
        userId: user.userId,
        platform: platformUpper,
        status: 'UPLOADING',
        metadataJson: validatedMeta as any,
        idempotencyKey,
      });

      if (isDuplicate && publication.status === 'PUBLISHED') {
        results.push({
          platform: platformUpper,
          success: true,
          status: publication.status,
          platformUrl: publication.platformUrl,
          message: 'المنشور موجود بالفعل (تم تفادي التكرار)',
        });
        continue;
      }

      // Execute Provider Publish
      const provider = createPublishingProvider(platformUpper);
      const submission = await provider.publish({
        publicationId: publication.id,
        videoId,
        renderId: activeRender.id,
        userId: user.userId,
        account: {
          id: account.id,
          platformUserId: account.platformUserId,
          accessToken,
        },
        metadata: validatedMeta,
        video: {
          r2ObjectKey: activeRender.objectKey,
          r2Bucket: activeRender.bucket || undefined,
          videoUrl: presignedVideo.url,
          sizeBytes: Number(activeRender.sizeBytes || 0),
          durationSeconds: parseFloat(activeRender.durationSeconds || '5'),
          width: activeRender.width,
          height: activeRender.height,
          mimeType: activeRender.mimeType || 'video/mp4',
        },
        idempotencyKey,
      });

      // Update publication in DB
      await updatePublicationStatusTransaction(
        publication.id,
        {
          status: submission.status,
          platformPublicationId: submission.platformPublicationId,
          platformUrl: submission.platformUrl,
        },
        {
          attempt: 1,
          providerRequestId: submission.providerRequestId,
          errorCode: submission.errorCode,
          errorMessage: submission.errorMessage,
          metadata: submission.metadata,
        }
      );

      results.push({
        platform: platformUpper,
        publicationId: publication.id,
        success: submission.success,
        status: submission.status,
        platformUrl: submission.platformUrl,
        error: submission.errorMessage,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'تمت معالجة طلبات النشر بنجاح',
      data: results,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_CREATE_PUBLICATION_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء معالجة طلب النشر' },
      { status: 500 }
    );
  }
}
