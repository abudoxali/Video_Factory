import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { RenderExecuteRequestSchema } from '@video-factory/contracts';
import { getActiveVideoRender, getVideoPlanDetails } from '@video-factory/database';
import { RenderCoordinator } from '@video-factory/providers';
import { RenderService } from '@video-factory/render-worker/service';
import { resolvePhaseJob } from '@/lib/orchestration';

/**
 * POST /api/internal/render/execute
 *
 * Real render boundary for n8n (VF-09). Runs the exact pipeline proven in
 * Parts 2 & 3: RenderCoordinator builds a validated manifest from the APPROVED
 * plan + persisted media, then RenderService executes the real Remotion render
 * and uploads the MP4 to storage. RENDER_READY is only ever reached after a
 * genuine persisted render — never from a fabricated callback.
 *
 * Idempotent: an existing READY render is reused unless `force` is set.
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = RenderExecuteRequestSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'بيانات طلب الإخراج غير مطابقة للمخطط',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  const { video_id, job_id, force } = parsed.data;

  try {
    const plan = await getVideoPlanDetails(video_id);
    if (!plan?.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }
    if (plan.video.planStatus !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'لا يمكن الإخراج قبل اعتماد الخطة' },
        { status: 409 }
      );
    }

    // Reuse an existing persisted READY render — a retry never duplicates work.
    if (!force) {
      const existing = await getActiveVideoRender(video_id);
      if (existing) {
        return NextResponse.json({
          success: true,
          video_id,
          reused: true,
          data: {
            renderId: existing.id,
            version: existing.version,
            status: existing.status,
            bucket: existing.bucket,
            objectKey: existing.objectKey,
            sizeBytes: existing.sizeBytes,
            checksum: existing.checksum,
            durationSeconds: existing.durationSeconds,
            width: existing.width,
            height: existing.height,
            fps: existing.fps,
          },
        });
      }
    }

    const job = await resolvePhaseJob({
      videoId: video_id,
      jobId: job_id,
      stage: 'RENDER_PREPARATION',
      message: 'بدء مرحلة إخراج الفيديو النهائي',
    });

    const coordinator = new RenderCoordinator();
    const manifest = await coordinator.buildRenderManifest(video_id);

    const renderService = new RenderService();
    const result = await renderService.renderVideo({
      manifest,
      jobId: job.id,
      userId: plan.video.userId || undefined,
      projectId: plan.video.projectId || undefined,
    });

    if (!result.success) {
      // RenderService already persisted FAILED + job failure truthfully.
      return NextResponse.json(
        {
          success: false,
          video_id,
          job_id: job.id,
          error: result.error?.message || 'فشل إخراج الفيديو',
          errorCode: result.error?.code,
          data: { renderId: result.renderId, status: result.status },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      video_id,
      job_id: job.id,
      reused: false,
      data: {
        renderId: result.renderId,
        version: result.version,
        status: result.status,
        bucket: result.bucket,
        objectKey: result.objectKey,
        sizeBytes: result.sizeBytes,
        checksum: result.checksum,
        durationSeconds: result.durationSeconds,
        width: result.width,
        height: result.height,
        fps: result.fps,
        latencyMs: result.latencyMs,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_RENDER_EXECUTE_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'فشل تنفيذ الإخراج' },
      { status: 500 }
    );
  }
}
