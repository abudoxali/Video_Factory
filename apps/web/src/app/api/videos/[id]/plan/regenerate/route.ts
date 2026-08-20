import { NextRequest, NextResponse } from 'next/server';
import { getVideoPlanDetails } from '@video-factory/database';
import { PlanningEngine } from '@video-factory/providers';
import type {
  VideoPlatform,
  VideoType,
  VideoLanguage,
  CreativeBrief,
  VideoScript,
} from '@video-factory/contracts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json().catch(() => ({}));
    const targetStage = body.stage || 'all'; // 'brief' | 'script' | 'scenes' | 'all'

    const plan = await getVideoPlanDetails(videoId);
    if (!plan || !plan.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }

    const { video, brief, script } = plan;
    const engine = new PlanningEngine();

    if (targetStage === 'brief' || targetStage === 'all' || !brief) {
      // Regenerate Brief -> Script -> Scenes
      await engine.executeFullPlanningPipeline({
        videoId,
        prompt: video.prompt,
        platform: video.platform as VideoPlatform,
        videoType: video.type as VideoType,
        durationSeconds: video.durationSeconds,
        language: (video.language || 'ar') as VideoLanguage,
      });
    } else {
      const briefContract: CreativeBrief = {
        id: brief.id,
        videoId: brief.videoId,
        workingTitle: brief.workingTitle,
        coreIdea: brief.coreIdea,
        objective: brief.objective,
        targetAudience: brief.targetAudience,
        tone: brief.tone,
        contentAngle: brief.contentAngle,
        hookStrategy: brief.hookStrategy,
        narrativeStyle: brief.narrativeStyle,
        visualDirection: brief.visualDirection,
        pacing: brief.pacing,
        callToAction: brief.callToAction || null,
        keyPoints: Array.isArray(brief.keyPoints) ? (brief.keyPoints as string[]) : [],
        constraints: Array.isArray(brief.constraints) ? (brief.constraints as string[]) : [],
        planningNotes: brief.planningNotes || null,
        requiresResearch: brief.requiresResearch,
        status: (brief.status || 'READY_FOR_REVIEW') as any,
        version: brief.version,
        platform: video.platform as VideoPlatform,
        videoType: video.type as VideoType,
        targetDurationSeconds: video.durationSeconds,
        language: (video.language || 'ar') as VideoLanguage,
      };

      if (targetStage === 'script') {
        // Regenerate Script -> Scenes
        const newScript = await engine.generateScript(briefContract);
        await engine.generateScenes({
          brief: briefContract,
          script: newScript,
        });
      } else if (targetStage === 'scenes' && script) {
        // Regenerate Scenes only
        const scriptContract: VideoScript = {
          id: script.id,
          videoId: script.videoId,
          briefId: script.briefId,
          title: script.title,
          hook: script.hook,
          sections: Array.isArray(script.sections) ? (script.sections as any) : [],
          fullNarration: script.fullNarration,
          estimatedWordCount: script.estimatedWordCount,
          estimatedDurationSeconds: script.estimatedDurationSeconds,
          language: (script.language || 'ar') as VideoLanguage,
          callToAction: script.callToAction || null,
          scriptVersion: script.scriptVersion,
          status: (script.status || 'READY_FOR_REVIEW') as any,
        };

        await engine.generateScenes({
          brief: briefContract,
          script: scriptContract,
        });
      }
    }

    const updated = await getVideoPlanDetails(videoId);

    return NextResponse.json({
      success: true,
      message: 'تمت إعادة إنشاء وتحديث خطة الفيديو بنجاح',
      data: updated,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_REGENERATE_PLAN_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء إعادة توليد الخطة' },
      { status: 500 }
    );
  }
}
