import { eq, and, desc, asc } from 'drizzle-orm';
import { getDb } from '../client';
import { mediaAssets, type MediaAssetEntity, type NewMediaAssetEntity } from '../schema/media-assets';
import { mediaRuns, type MediaRunEntity, type NewMediaRunEntity } from '../schema/media-runs';
import { scenes } from '../schema/scenes';
import { videos } from '../schema/videos';
import { videoJobs } from '../schema/jobs';
import { jobEvents } from '../schema/events';
import { createId } from '../ids';
import type { MediaAsset, SceneMediaState } from '@video-factory/contracts';

export async function saveMediaAssetTransaction(
  assetData: Omit<NewMediaAssetEntity, 'id' | 'createdAt' | 'updatedAt'>,
  options?: {
    jobId?: string;
    targetMediaState?: SceneMediaState;
    supersedePrior?: boolean;
  }
): Promise<MediaAssetEntity> {
  const db = getDb();
  const assetId = createId('evt').replace('evt_', 'ast_');
  const supersedePrior = options?.supersedePrior ?? true;

  return await db.transaction(async (tx) => {
    // 1. If sceneId and type provided, supersede prior active assets if requested
    if (assetData.sceneId && supersedePrior) {
      await tx
        .update(mediaAssets)
        .set({ status: 'SUPERSEDED', updatedAt: new Date() })
        .where(
          and(
            eq(mediaAssets.sceneId, assetData.sceneId),
            eq(mediaAssets.type, assetData.type),
            eq(mediaAssets.status, 'ACTIVE')
          )
        );
    }

    // 2. Insert new asset
    const [inserted] = await tx
      .insert(mediaAssets)
      .values({
        id: assetId,
        ...assetData,
        status: assetData.status || 'ACTIVE',
      })
      .returning();

    // 3. Update Scene media state and duration if applicable
    if (assetData.sceneId) {
      const sceneUpdates: Record<string, unknown> = {
        mediaState: options?.targetMediaState || 'READY',
        updatedAt: new Date(),
      };

      if (assetData.type === 'VOICE' && assetData.durationSeconds) {
        sceneUpdates.voiceActualDurationSeconds = String(assetData.durationSeconds);
      }
      if (assetData.type === 'IMAGE' || assetData.type === 'VIDEO') {
        sceneUpdates.referenceAssetId = assetId;
      }

      await tx.update(scenes).set(sceneUpdates).where(eq(scenes.id, assetData.sceneId));
    }

    // 4. Log event if jobId provided
    if (options?.jobId) {
      await tx.insert(jobEvents).values({
        id: createId('evt'),
        jobId: options.jobId,
        eventId: `evt_asset_${assetData.type.toLowerCase()}_${Date.now()}`,
        eventType: `ASSET_${assetData.type}_SAVED`,
        stage: assetData.type === 'VOICE' ? 'VOICE_GENERATION' : 'ASSET_STORAGE',
        progress: 85,
        message: `تم حفظ وتخزين مادة ${assetData.type} بنجاح في R2`,
        metadata: {
          assetId,
          type: assetData.type,
          objectKey: assetData.objectKey,
          sizeBytes: assetData.sizeBytes,
        },
      });
    }

    return inserted;
  });
}

export async function updateSceneMediaStateTransaction(
  sceneId: string,
  mediaState: SceneMediaState,
  jobId?: string,
  message?: string
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(scenes)
      .set({ mediaState, updatedAt: new Date() })
      .where(eq(scenes.id, sceneId));

    if (jobId && message) {
      await tx.insert(jobEvents).values({
        id: createId('evt'),
        jobId,
        eventId: `evt_scene_state_${Date.now()}`,
        eventType: 'SCENE_MEDIA_STATE_CHANGED',
        stage: 'MEDIA_PREPARATION',
        progress: 60,
        message,
        metadata: { sceneId, mediaState },
      });
    }
  });
}

export async function recordMediaRunTransaction(
  runData: Omit<NewMediaRunEntity, 'id' | 'createdAt'>
): Promise<MediaRunEntity> {
  const db = getDb();
  const id = createId('evt').replace('evt_', 'mrun_');

  const [record] = await db
    .insert(mediaRuns)
    .values({
      id,
      ...runData,
    })
    .returning();

  return record;
}

/**
 * Returns the most recent media generation run for a scene/asset type.
 * Used to resume asynchronous provider submissions (e.g. AI video) instead of
 * re-submitting duplicates on workflow retries.
 */
export async function getLatestMediaRunForScene(
  sceneId: string,
  type: string
): Promise<MediaRunEntity | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mediaRuns)
    .where(and(eq(mediaRuns.sceneId, sceneId), eq(mediaRuns.type, type)))
    .orderBy(desc(mediaRuns.startedAt))
    .limit(1);
  return rows[0] || null;
}

/**
 * Updates a media run record — truthful telemetry for provider submissions.
 */
export async function updateMediaRunStatus(
  runId: string,
  update: {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    completedAt?: Date;
    latencyMs?: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    outputMetadata?: Record<string, unknown> | null;
    usageMetadata?: Record<string, unknown> | null;
  }
): Promise<MediaRunEntity | null> {
  const db = getDb();
  const rows = await db
    .update(mediaRuns)
    .set({
      status: update.status,
      completedAt: update.completedAt,
      latencyMs: update.latencyMs,
      errorCode: update.errorCode,
      errorMessage: update.errorMessage,
      outputMetadata: update.outputMetadata === undefined ? undefined : update.outputMetadata,
      usageMetadata: update.usageMetadata === undefined ? undefined : update.usageMetadata,
    })
    .where(eq(mediaRuns.id, runId))
    .returning();
  return rows[0] || null;
}

export async function getVideoMediaAssets(videoId: string): Promise<MediaAssetEntity[]> {
  const db = getDb();
  return await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.videoId, videoId))
    .orderBy(asc(mediaAssets.createdAt));
}

export async function getSceneMediaAssets(sceneId: string): Promise<MediaAssetEntity[]> {
  const db = getDb();
  return await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.sceneId, sceneId))
    .orderBy(desc(mediaAssets.createdAt));
}

export async function getMediaAssetById(assetId: string): Promise<MediaAssetEntity | null> {
  const db = getDb();
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  return rows[0] || null;
}

export async function supersedeMediaAsset(assetId: string): Promise<void> {
  const db = getDb();
  await db
    .update(mediaAssets)
    .set({ status: 'SUPERSEDED', updatedAt: new Date() })
    .where(eq(mediaAssets.id, assetId));
}
