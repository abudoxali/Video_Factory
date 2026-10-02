import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { PlanningExecuteRequestSchema } from '@video-factory/contracts';
import { getJobWithDetails, getVideoPlanDetails } from '@video-factory/database';
import { PlanningEngine } from '@video-factory/providers';
import {
  briefEntityToContract,
  chapterEntityToContract,
  emitPhaseEvent,
  resolvePhaseJob,
  scriptEntityToContract,
} from '@/lib/orchestration';

/**
 * POST /api/internal/planning/execute
 *
 * Real provider-backed planning boundary for n8n (VF-00 .. VF-03). Invokes
 * PlanningEngine — the existing Gemini/OpenAI structured-output layer — and
 * persists actual results. No deterministic or fabricated output is produced
 * here; provider failures propagate truthfully and mark the job FAILED.
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = PlanningExecuteRequestSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'جسم الطلب غير صالح' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'بيانات طلب التنفيذ غير مطابقة للمخطط',
        details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  const { job_id, video_id, stage } = parsed.data;
  let phaseJobId: string | undefined = job_id || undefined;

  try {
    let job;
    let video;
    if (job_id) {
      const jobDetails = await getJobWithDetails(job_id);
      if (!jobDetails?.job) {
        return NextResponse.json(
          { success: false, error: `المهمة ${job_id} غير موجودة` },
          { status: 404 }
        );
      }
      if (jobDetails.job.videoId !== video_id) {
        return NextResponse.json(
          { success: false, error: 'المهمة لا تنتمي إلى الفيديو المحدد' },
          { status: 400 }
        );
      }
      job = jobDetails.job;
      video = jobDetails.video;
    }
    if (!video) {
      const plan = await getVideoPlanDetails(video_id);
      video = plan?.video || null;
    }
    if (!video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو المرتبط بالمهمة غير موجود' },
        { status: 404 }
      );
    }
    if (!job) {
      job = await resolvePhaseJob({
        videoId: video_id,
        stage: stage || 'AI_DIRECTOR',
        message: 'بدء تنفيذ مرحلة التخطيط',
      });
      phaseJobId = job.id;
    }

    const engine = new PlanningEngine();
    const pipelineInput = {
      videoId: video_id,
      jobId: job.id,
      prompt: video.prompt,
      platform: video.platform as never,
      videoType: video.type as never,
      durationSeconds: video.durationSeconds,
      language: (video.language || 'ar') as never,
    };

    let data: Record<string, unknown>;

    if (!stage) {
      // Full pipeline: brief → script → (chapters) → scenes
      const result = await engine.executeFullPlanningPipeline(pipelineInput);
      if (!result.success) {
        throw new Error(result.error || 'فشل خط التخطيط الإنتاجي');
      }
      data = {
        briefId: result.brief?.id,
        scriptId: result.script?.id,
        chapterCount: result.chapters?.length || 0,
        sceneCount: result.scenes?.length || 0,
        totalDurationSeconds: result.totalDurationSeconds,
      };
    } else if (stage === 'AI_DIRECTOR') {
      const brief = await engine.generateCreativeBrief(pipelineInput);
      data = { briefId: brief.id, workingTitle: brief.workingTitle };
    } else {
      const plan = await getVideoPlanDetails(video_id);
      if (!plan?.brief) {
        return NextResponse.json(
          { success: false, error: 'لا يوجد توجيه إبداعي محفوظ — نفّذ مرحلة AI_DIRECTOR أولاً' },
          { status: 409 }
        );
      }
      const brief = briefEntityToContract(plan.brief, video);

      if (stage === 'SCRIPT_GENERATION') {
        const script = await engine.generateScript(brief, job.id);
        data = { scriptId: script.id, sections: script.sections.length };
      } else {
        // SCENE_PLANNING
        if (!plan.script) {
          return NextResponse.json(
            { success: false, error: 'لا يوجد سيناريو محفوظ — نفّذ مرحلة SCRIPT_GENERATION أولاً' },
            { status: 409 }
          );
        }
        const script = scriptEntityToContract(plan.script);
        const allScenes = [];
        const chapters = plan.chapters || [];
        const isLongForm = video.durationSeconds > 60 || video.type === 'long';

        if (isLongForm && chapters.length > 0) {
          for (const ch of chapters) {
            const chapter = chapterEntityToContract(ch);
            const chapterScenes = await engine.generateScenes({
              brief,
              script,
              chapter,
              jobId: job.id,
            });
            allScenes.push(...chapterScenes);
          }
        } else {
          const scenes = await engine.generateScenes({ brief, script, jobId: job.id });
          allScenes.push(...scenes);
        }
        data = { sceneCount: allScenes.length };
      }
    }

    return NextResponse.json({
      success: true,
      stage: stage || 'FULL_PIPELINE',
      job_id: job.id,
      video_id,
      data,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_PLANNING_EXECUTE_ERROR]', err);
    // Truthful failure: mark the job FAILED through the shared state machine.
    if (phaseJobId) await emitPhaseEvent({
      jobId: phaseJobId,
      eventIdSuffix: `planning_failed_${Date.now()}`,
      event: 'planning.failed',
      status: 'FAILED',
      stage: 'ERROR',
      progress: 0,
      message: err.message,
    }).catch(() => undefined);
    return NextResponse.json(
      { success: false, error: err.message || 'فشل تنفيذ التخطيط' },
      { status: 500 }
    );
  }
}
