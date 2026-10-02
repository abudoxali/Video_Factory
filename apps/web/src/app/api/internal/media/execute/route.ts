import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { MediaExecuteRequestSchema } from '@video-factory/contracts';
import { getVideoPlanDetails } from '@video-factory/database';
import { MediaCoordinator } from '@video-factory/providers';
import { emitPhaseEvent, resolvePhaseJob } from '@/lib/orchestration';

/**
 * POST /api/internal/media/execute
 *
 * Real media-generation boundary for n8n (VF-04 .. VF-07). Runs
 * MediaCoordinator against the configured image/video/voice providers and R2
 * storage. Scenes only reach READY when real persisted assets exist; async
 * video providers surface truthful QUEUED/PROCESSING/COMPLETED/FAILED states.
 * Execution is idempotent — retries resume pending provider runs instead of
 * re-submitting them.
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = MediaExecuteRequestSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'بيانات طلب توليد الوسائط غير مطابقة للمخطط',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  const { video_id, job_id, scene_id, asset_types } = parsed.data;

  try {
    const plan = await getVideoPlanDetails(video_id);
    if (!plan?.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }
    if (plan.video.planStatus !== 'APPROVED') {
      // Human approval is a hard gate — media generation never starts on an
      // unapproved plan.
      return NextResponse.json(
        { success: false, error: 'لا يمكن توليد الوسائط قبل اعتماد الخطة' },
        { status: 409 }
      );
    }

    const job = await resolvePhaseJob({
      videoId: video_id,
      jobId: job_id,
      stage: 'MEDIA_PREPARATION',
      message: 'بدء مرحلة توليد وسائط المشاهد',
    });

    const coordinator = new MediaCoordinator();
    const result = await coordinator.executeMediaPipeline({
      videoId: video_id,
      jobId: job.id,
      userId: plan.video.userId || undefined,
      projectId: plan.video.projectId || undefined,
      sceneId: scene_id,
      assetTypes: asset_types,
    });

    // Record the truthful terminal state on the phase job.
    if (result.allReady) {
      await emitPhaseEvent({
        jobId: job.id,
        eventIdSuffix: 'media_ready',
        event: 'media.ready',
        status: 'COMPLETED',
        stage: 'MEDIA_READY',
        progress: 100,
        message: 'اكتملت وسائط جميع المشاهد وتم تخزينها بنجاح',
      });
    } else if (result.failedScenes > 0 && result.allResolved) {
      await emitPhaseEvent({
        jobId: job.id,
        eventIdSuffix: `media_failed_${Date.now()}`,
        event: 'media.failed',
        status: 'FAILED',
        stage: 'ERROR',
        progress: 60,
        message: `فشل توليد وسائط ${result.failedScenes} مشهد`,
      });
    }
    // generatingScenes > 0 → job stays PROCESSING; the next poll resumes them.

    return NextResponse.json({
      success: true,
      job_id: job.id,
      video_id,
      data: {
        totalScenes: result.totalScenes,
        readyScenes: result.readyScenes,
        awaitingStockScenes: result.awaitingStockScenes,
        timingReviewScenes: result.timingReviewScenes,
        generatingScenes: result.generatingScenes,
        failedScenes: result.failedScenes,
        allResolved: result.allResolved,
        allReady: result.allReady,
        sceneResults: result.sceneResults.map((r) => ({
          sceneId: r.sceneId,
          position: r.position,
          mediaStrategy: r.mediaStrategy,
          mediaState: r.mediaState,
          skipped: !!r.skipped,
          providerRequestId: r.providerRequestId,
          error: r.error,
        })),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_MEDIA_EXECUTE_ERROR]', err);
    if (job_id) {
      await emitPhaseEvent({
        jobId: job_id,
        eventIdSuffix: `media_failed_${Date.now()}`,
        event: 'media.failed',
        status: 'FAILED',
        stage: 'ERROR',
        progress: 0,
        message: err.message,
      }).catch(() => undefined);
    }
    return NextResponse.json(
      { success: false, error: err.message || 'فشل تنفيذ توليد الوسائط' },
      { status: 500 }
    );
  }
}
