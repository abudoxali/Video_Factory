import { eq, asc, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { videos } from '../schema/videos';
import { videoJobs } from '../schema/jobs';
import { jobEvents } from '../schema/events';
import { videoBriefs, type VideoBrief } from '../schema/briefs';
import { videoScripts, type VideoScriptEntity } from '../schema/scripts';
import { videoChapters, type VideoChapterEntity } from '../schema/chapters';
import { scenes, type SceneEntity } from '../schema/scenes';
import { aiRuns, type NewAIRunEntity, type AIRunEntity } from '../schema/ai-runs';
import { createId } from '../ids';
import {
  type CreativeBrief,
  type VideoScript,
  type VideoChapter,
  type Scene,
  type PlanningPayload,
  validateAndAdjustTimeline,
  calculateTimeline,
} from '@video-factory/contracts';

export interface VideoPlanDetails {
  video: typeof videos.$inferSelect | null;
  brief: VideoBrief | null;
  script: VideoScriptEntity | null;
  chapters: VideoChapterEntity[];
  scenes: SceneEntity[];
  totalDurationSeconds: number;
  isApproved: boolean;
}

export async function getVideoPlanDetails(videoId: string): Promise<VideoPlanDetails | null> {
  const db = getDb();
  try {
    const videoRows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!videoRows || videoRows.length === 0 || !videoRows[0]) {
      return null;
    }
    const video = videoRows[0];

    const briefRows = await db
      .select()
      .from(videoBriefs)
      .where(eq(videoBriefs.videoId, videoId))
      .orderBy(desc(videoBriefs.version), desc(videoBriefs.createdAt))
      .limit(1);
    const brief = briefRows[0] || null;

    const scriptRows = await db
      .select()
      .from(videoScripts)
      .where(eq(videoScripts.videoId, videoId))
      .orderBy(desc(videoScripts.scriptVersion), desc(videoScripts.createdAt))
      .limit(1);
    const script = scriptRows[0] || null;

    const chapters = await db
      .select()
      .from(videoChapters)
      .where(eq(videoChapters.videoId, videoId))
      .orderBy(asc(videoChapters.position));

    const sceneRows = await db
      .select()
      .from(scenes)
      .where(eq(scenes.videoId, videoId))
      .orderBy(asc(scenes.position));

    const totalDurationSeconds = sceneRows.reduce((sum, s) => sum + s.durationSeconds, 0);

    return {
      video,
      brief,
      script,
      chapters,
      scenes: sceneRows,
      totalDurationSeconds,
      isApproved: video.planStatus === 'APPROVED',
    };
  } catch (error) {
    console.error('[GET_VIDEO_PLAN_ERROR]', error);
    return null;
  }
}

export async function updateVideoPlanDetailsTransaction(
  videoId: string,
  updates: {
    title?: string;
    scriptText?: string;
    scenes?: Scene[];
  }
): Promise<VideoPlanDetails | null> {
  const db = getDb();

  await db.transaction(async (tx) => {
    // 1. Update title
    if (updates.title && typeof updates.title === 'string') {
      await tx
        .update(videos)
        .set({ title: updates.title.trim(), updatedAt: new Date() })
        .where(eq(videos.id, videoId));
    }

    // 2. Update script narration
    if (updates.scriptText && typeof updates.scriptText === 'string') {
      await tx
        .update(videoScripts)
        .set({
          fullNarration: updates.scriptText.trim(),
          estimatedWordCount: updates.scriptText.trim().split(/\s+/).length,
          updatedAt: new Date(),
        })
        .where(eq(videoScripts.videoId, videoId));
    }

    // 3. Update scenes & timestamps
    if (updates.scenes && Array.isArray(updates.scenes) && updates.scenes.length > 0) {
      const adjustedTimeline = calculateTimeline(updates.scenes);

      for (const sc of adjustedTimeline) {
        if (sc.id) {
          await tx
            .update(scenes)
            .set({
              narration: sc.narration ?? '',
              onScreenText: sc.onScreenText ?? null,
              visualDescription: sc.visualDescription ?? '',
              visualPrompt: sc.visualPrompt ?? '',
              mediaStrategy: sc.mediaStrategy ?? 'AI_VIDEO',
              durationSeconds: sc.durationSeconds,
              startTime: sc.startTime,
              endTime: sc.endTime,
              updatedAt: new Date(),
            })
            .where(eq(scenes.id, sc.id));
        }
      }
    }
  });

  return await getVideoPlanDetails(videoId);
}

export async function saveCreativeBriefTransaction(
  briefData: CreativeBrief,
  jobId?: string
): Promise<VideoBrief> {
  const db = getDb();
  const briefId = briefData.id || createId('evt').replace('evt_', 'brf_');

  return await db.transaction(async (tx) => {
    // 1. Insert brief
    const [created] = await tx
      .insert(videoBriefs)
      .values({
        id: briefId,
        videoId: briefData.videoId,
        workingTitle: briefData.workingTitle,
        coreIdea: briefData.coreIdea,
        objective: briefData.objective,
        targetAudience: briefData.targetAudience,
        tone: briefData.tone,
        contentAngle: briefData.contentAngle,
        hookStrategy: briefData.hookStrategy,
        narrativeStyle: briefData.narrativeStyle,
        visualDirection: briefData.visualDirection,
        pacing: briefData.pacing || 'moderate',
        callToAction: briefData.callToAction || null,
        keyPoints: briefData.keyPoints,
        constraints: briefData.constraints,
        planningNotes: briefData.planningNotes || null,
        requiresResearch: briefData.requiresResearch || false,
        status: briefData.status || 'READY_FOR_REVIEW',
        version: briefData.version || 1,
      })
      .returning();

    // 2. Mark downstream as stale if regeneration
    await tx
      .update(videoScripts)
      .set({ status: 'STALE', updatedAt: new Date() })
      .where(eq(videoScripts.videoId, briefData.videoId));

    await tx
      .update(scenes)
      .set({ status: 'STALE', updatedAt: new Date() })
      .where(eq(scenes.videoId, briefData.videoId));

    await tx
      .update(videos)
      .set({ title: briefData.workingTitle, planStatus: 'GENERATING', updatedAt: new Date() })
      .where(eq(videos.id, briefData.videoId));

    if (jobId) {
      await tx.insert(jobEvents).values({
        id: createId('evt'),
        jobId,
        eventId: `evt_brief_${Date.now()}`,
        eventType: 'BRIEF_GENERATED',
        stage: 'AI_DIRECTOR',
        progress: 25,
        message: 'تم إعداد التوجيه الإبداعي وتحديد الفكرة والجمهور والنمط البصري',
        metadata: { workingTitle: briefData.workingTitle, visualDirection: briefData.visualDirection },
      });
    }

    return created;
  });
}

export async function saveVideoScriptTransaction(
  scriptData: VideoScript,
  jobId?: string
): Promise<VideoScriptEntity> {
  const db = getDb();
  const scriptId = scriptData.id || createId('evt').replace('evt_', 'scr_');

  return await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(videoScripts)
      .values({
        id: scriptId,
        videoId: scriptData.videoId,
        briefId: scriptData.briefId || null,
        title: scriptData.title,
        hook: scriptData.hook,
        sections: scriptData.sections,
        fullNarration: scriptData.fullNarration,
        estimatedWordCount: scriptData.estimatedWordCount,
        estimatedDurationSeconds: scriptData.estimatedDurationSeconds,
        language: scriptData.language || 'ar',
        callToAction: scriptData.callToAction || null,
        scriptVersion: scriptData.scriptVersion || 1,
        status: scriptData.status || 'READY_FOR_REVIEW',
      })
      .returning();

    await tx
      .update(scenes)
      .set({ status: 'STALE', updatedAt: new Date() })
      .where(eq(scenes.videoId, scriptData.videoId));

    if (jobId) {
      await tx.insert(jobEvents).values({
        id: createId('evt'),
        jobId,
        eventId: `evt_script_${Date.now()}`,
        eventType: 'SCRIPT_GENERATED',
        stage: 'SCRIPT_GENERATION',
        progress: 50,
        message: 'تمت كتابة السيناريو الكامل وتوزيع المقاطع السردية',
        metadata: {
          wordCount: scriptData.estimatedWordCount,
          duration: scriptData.estimatedDurationSeconds,
        },
      });
    }

    return created;
  });
}

export async function saveScenesTransaction(
  videoId: string,
  rawScenes: Scene[],
  jobId?: string,
  targetDurationSeconds: number = 30
): Promise<SceneEntity[]> {
  const db = getDb();

  // Deterministic timeline arithmetic
  const timelineResult = validateAndAdjustTimeline(rawScenes, targetDurationSeconds, 15);
  const adjustedScenes = timelineResult.scenes;

  return await db.transaction(async (tx) => {
    // 1. Remove prior scenes for this video
    await tx.delete(scenes).where(eq(scenes.videoId, videoId));

    // 2. Batch insert adjusted scenes
    const insertedScenes: SceneEntity[] = [];
    for (const sc of adjustedScenes) {
      const sceneId = sc.id || createId('evt').replace('evt_', 'scn_');
      const [inserted] = await tx
        .insert(scenes)
        .values({
          id: sceneId,
          videoId,
          chapterId: sc.chapterId || null,
          position: sc.position,
          purpose: sc.purpose || '',
          narration: sc.narration || '',
          onScreenText: sc.onScreenText || null,
          visualDescription: sc.visualDescription,
          visualPrompt: sc.visualPrompt,
          mediaStrategy: sc.mediaStrategy || 'AI_VIDEO',
          animationDirection: sc.animationDirection || null,
          cameraDirection: sc.cameraDirection || null,
          transition: sc.transition || null,
          durationSeconds: sc.durationSeconds,
          startTime: sc.startTime,
          endTime: sc.endTime,
          shotType: sc.shotType || null,
          lighting: sc.lighting || null,
          environment: sc.environment || null,
          subject: sc.subject || null,
          characterNotes: sc.characterNotes || null,
          continuityNotes: sc.continuityNotes || null,
          status: 'PLANNED',
        })
        .returning();
      insertedScenes.push(inserted);
    }

    // 3. Mark plan as READY_FOR_REVIEW
    await tx
      .update(videos)
      .set({
        planStatus: 'READY_FOR_REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    if (jobId) {
      await tx.insert(jobEvents).values({
        id: createId('evt'),
        jobId,
        eventId: `evt_scenes_${Date.now()}`,
        eventType: 'SCENES_PLANNED',
        stage: 'PLAN_READY',
        progress: 100,
        message: `تم توزيع ${insertedScenes.length} مشهد ومطابقة الخط الزمني، الخطة جاهزة للمراجعة`,
        metadata: {
          sceneCount: insertedScenes.length,
          totalDuration: timelineResult.totalDuration,
        },
      });

      await tx
        .update(videoJobs)
        .set({
          status: 'COMPLETED',
          progress: 100,
          currentStage: 'PLAN_READY',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobId));
    }

    return insertedScenes;
  });
}

export async function saveCompletePlanningBundleTransaction(
  payload: PlanningPayload
): Promise<boolean> {
  const db = getDb();

  return await db.transaction(async (tx) => {
    // 1. Save Brief if present
    if (payload.brief) {
      const briefId = payload.brief.id || createId('evt').replace('evt_', 'brf_');
      await tx
        .insert(videoBriefs)
        .values({
          id: briefId,
          videoId: payload.video_id,
          workingTitle: payload.brief.workingTitle,
          coreIdea: payload.brief.coreIdea,
          objective: payload.brief.objective,
          targetAudience: payload.brief.targetAudience,
          tone: payload.brief.tone,
          contentAngle: payload.brief.contentAngle,
          hookStrategy: payload.brief.hookStrategy,
          narrativeStyle: payload.brief.narrativeStyle,
          visualDirection: payload.brief.visualDirection,
          pacing: payload.brief.pacing || 'moderate',
          callToAction: payload.brief.callToAction || null,
          keyPoints: payload.brief.keyPoints,
          constraints: payload.brief.constraints,
          planningNotes: payload.brief.planningNotes || null,
          requiresResearch: payload.brief.requiresResearch || false,
          status: 'READY_FOR_REVIEW',
          version: payload.brief.version || 1,
        })
        .onConflictDoNothing();
    }

    // 2. Save Script if present
    if (payload.script) {
      const scriptId = payload.script.id || createId('evt').replace('evt_', 'scr_');
      await tx
        .insert(videoScripts)
        .values({
          id: scriptId,
          videoId: payload.video_id,
          title: payload.script.title,
          hook: payload.script.hook,
          sections: payload.script.sections,
          fullNarration: payload.script.fullNarration,
          estimatedWordCount: payload.script.estimatedWordCount,
          estimatedDurationSeconds: payload.script.estimatedDurationSeconds,
          language: payload.script.language || 'ar',
          callToAction: payload.script.callToAction || null,
          scriptVersion: payload.script.scriptVersion || 1,
          status: 'READY_FOR_REVIEW',
        })
        .onConflictDoNothing();
    }

    // 3. Save Chapters if present
    if (payload.chapters && payload.chapters.length > 0) {
      await tx.delete(videoChapters).where(eq(videoChapters.videoId, payload.video_id));
      for (const ch of payload.chapters) {
        const chapterId = ch.id || createId('evt').replace('evt_', 'chp_');
        await tx.insert(videoChapters).values({
          id: chapterId,
          videoId: payload.video_id,
          position: ch.position,
          title: ch.title,
          purpose: ch.purpose,
          summary: ch.summary,
          targetDurationSeconds: ch.targetDurationSeconds,
          scriptText: ch.scriptText || null,
        });
      }
    }

    // 4. Save Scenes if present
    if (payload.scenes && payload.scenes.length > 0) {
      const timelineResult = validateAndAdjustTimeline(payload.scenes, 30, 15);
      await tx.delete(scenes).where(eq(scenes.videoId, payload.video_id));

      for (const sc of timelineResult.scenes) {
        const sceneId = sc.id || createId('evt').replace('evt_', 'scn_');
        await tx.insert(scenes).values({
          id: sceneId,
          videoId: payload.video_id,
          chapterId: sc.chapterId || null,
          position: sc.position,
          purpose: sc.purpose || '',
          narration: sc.narration || '',
          onScreenText: sc.onScreenText || null,
          visualDescription: sc.visualDescription,
          visualPrompt: sc.visualPrompt,
          mediaStrategy: sc.mediaStrategy || 'AI_VIDEO',
          animationDirection: sc.animationDirection || null,
          cameraDirection: sc.cameraDirection || null,
          transition: sc.transition || null,
          durationSeconds: sc.durationSeconds,
          startTime: sc.startTime,
          endTime: sc.endTime,
          shotType: sc.shotType || null,
          lighting: sc.lighting || null,
          environment: sc.environment || null,
          subject: sc.subject || null,
          characterNotes: sc.characterNotes || null,
          continuityNotes: sc.continuityNotes || null,
          status: 'PLANNED',
        });
      }

      await tx
        .update(videos)
        .set({ planStatus: 'READY_FOR_REVIEW', updatedAt: new Date() })
        .where(eq(videos.id, payload.video_id));
    }

    // 5. Update Job & append Job Event
    await tx
      .update(videoJobs)
      .set({
        status: payload.progress >= 100 ? 'COMPLETED' : 'PROCESSING',
        progress: payload.progress,
        currentStage: payload.stage,
        completedAt: payload.progress >= 100 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, payload.job_id));

    await tx.insert(jobEvents).values({
      id: createId('evt'),
      jobId: payload.job_id,
      eventId: `evt_plan_${payload.stage}_${Date.now()}`,
      eventType: `PLANNING_${payload.stage}`,
      stage: payload.stage,
      progress: payload.progress,
      message: payload.message || 'تم تحديث مرحلة التخطيط الإنتاجي للفيديو',
      metadata: { stage: payload.stage },
    });

    return true;
  });
}

export async function approveVideoPlan(videoId: string): Promise<typeof videos.$inferSelect | null> {
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(videos)
      .set({
        planStatus: 'APPROVED',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId))
      .returning();

    await tx
      .update(scenes)
      .set({ status: 'APPROVED', updatedAt: new Date() })
      .where(eq(scenes.videoId, videoId));

    await tx
      .update(videoBriefs)
      .set({ status: 'APPROVED', updatedAt: new Date() })
      .where(eq(videoBriefs.videoId, videoId));

    await tx
      .update(videoScripts)
      .set({ status: 'APPROVED', updatedAt: new Date() })
      .where(eq(videoScripts.videoId, videoId));

    return updated || null;
  });
}

export async function recordAIRun(
  runData: Omit<NewAIRunEntity, 'id' | 'createdAt'>
): Promise<AIRunEntity> {
  const db = getDb();
  const id = createId('evt').replace('evt_', 'air_');

  const [record] = await db
    .insert(aiRuns)
    .values({
      id,
      ...runData,
    })
    .returning();

  return record;
}
