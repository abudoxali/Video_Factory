import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../client';
import { renders, type RenderRecord, type NewRenderRecord } from '../schema/renders';
import { renderRuns, type RenderRunRecord, type NewRenderRunRecord } from '../schema/render-runs';
import { videoJobs } from '../schema/jobs';
import { jobEvents } from '../schema/events';

export interface CreateRenderOptions {
  jobId?: string;
  supersedePrior?: boolean;
}

/**
 * Creates a new render record with automatic incrementing version for the video
 */
export async function createRenderTransaction(
  renderData: Omit<NewRenderRecord, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    version?: number;
    status?: string;
  },
  options?: CreateRenderOptions
): Promise<RenderRecord> {
  const db = getDb();
  const renderId = renderData.id || `rnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await db.transaction(async (tx: any) => {
    // 1. Determine next version number if not explicitly passed
    let version = renderData.version;
    if (!version) {
      const existingRenders = await tx
        .select({ version: renders.version })
        .from(renders)
        .where(eq(renders.videoId, renderData.videoId))
        .orderBy(desc(renders.version))
        .limit(1);

      version = existingRenders.length > 0 ? existingRenders[0].version + 1 : 1;
    }

    // 2. If supersedePrior is set, mark existing READY renders as SUPERSEDED
    if (options?.supersedePrior) {
      await tx
        .update(renders)
        .set({
          status: 'SUPERSEDED',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(renders.videoId, renderData.videoId),
            eq(renders.status, 'READY')
          )
        );
    }

    // 3. Insert new render record
    const [insertedRender] = await tx
      .insert(renders)
      .values({
        id: renderId,
        videoId: renderData.videoId,
        version,
        status: renderData.status || 'PENDING',
        width: renderData.width || 1080,
        height: renderData.height || 1920,
        fps: renderData.fps || 30,
        durationSeconds: renderData.durationSeconds,
        durationFrames: renderData.durationFrames,
        manifestJson: renderData.manifestJson,
        storageProvider: renderData.storageProvider || 'r2',
        bucket: renderData.bucket,
        objectKey: renderData.objectKey,
        mimeType: renderData.mimeType || 'video/mp4',
        sizeBytes: renderData.sizeBytes,
        checksum: renderData.checksum,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 4. Record initial render_run audit entry
    const runId = `rn_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await tx.insert(renderRuns).values({
      id: runId,
      renderId,
      videoId: renderData.videoId,
      engine: 'remotion',
      engineVersion: '4.0.0',
      status: 'PROCESSING',
      attempt: 1,
      startedAt: new Date(),
      inputMetadata: {
        width: insertedRender.width,
        height: insertedRender.height,
        fps: insertedRender.fps,
        version: insertedRender.version,
      },
    });

    // 5. Update linked job stage if jobId provided
    if (options?.jobId) {
      await tx
        .update(videoJobs)
        .set({
          currentStage: 'RENDERING',
          progress: 85,
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, options.jobId));

      await tx.insert(jobEvents).values({
        id: `evt_rnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        jobId: options.jobId,
        eventId: `evt_render_created_${renderId}_${Date.now()}`,
        eventType: 'render.created',
        stage: 'RENDERING',
        progress: 85,
        message: `تم إنشاء مهمة الإخراج للإصدار v${version}`,
      });
    }

    return insertedRender;
  });
}

/**
 * Updates a render record status and outputs atomically
 */
export async function updateRenderStatusTransaction(
  renderId: string,
  update: {
    status: string;
    bucket?: string;
    objectKey?: string;
    sizeBytes?: number;
    checksum?: string;
    durationSeconds?: string;
    completedAt?: Date;
  },
  options?: {
    jobId?: string;
    message?: string;
    errorCode?: string;
    errorMessage?: string;
    latencyMs?: number;
  }
): Promise<RenderRecord | null> {
  const db = getDb();

  return await db.transaction(async (tx: any) => {
    const existing = await tx
      .select()
      .from(renders)
      .where(eq(renders.id, renderId))
      .limit(1);

    if (existing.length === 0) return null;
    const current = existing[0];

    // If transitioning to READY, mark any previous READY renders for this video as SUPERSEDED
    if (update.status === 'READY') {
      await tx
        .update(renders)
        .set({
          status: 'SUPERSEDED',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(renders.videoId, current.videoId),
            eq(renders.status, 'READY')
          )
        );
    }

    const [updatedRender] = await tx
      .update(renders)
      .set({
        status: update.status,
        bucket: update.bucket !== undefined ? update.bucket : current.bucket,
        objectKey: update.objectKey !== undefined ? update.objectKey : current.objectKey,
        sizeBytes: update.sizeBytes !== undefined ? update.sizeBytes : current.sizeBytes,
        checksum: update.checksum !== undefined ? update.checksum : current.checksum,
        durationSeconds:
          update.durationSeconds !== undefined ? update.durationSeconds : current.durationSeconds,
        completedAt:
          update.status === 'READY' || update.status === 'FAILED'
            ? update.completedAt || new Date()
            : current.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(renders.id, renderId))
      .returning();

    // Update active render run
    const activeRuns = await tx
      .select()
      .from(renderRuns)
      .where(eq(renderRuns.renderId, renderId))
      .orderBy(desc(renderRuns.startedAt))
      .limit(1);

    if (activeRuns.length > 0) {
      await tx
        .update(renderRuns)
        .set({
          status: update.status === 'READY' ? 'COMPLETED' : update.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
          completedAt: update.status === 'READY' || update.status === 'FAILED' ? new Date() : null,
          latencyMs: options?.latencyMs,
          errorCode: options?.errorCode,
          errorMessage: options?.errorMessage,
          outputMetadata: {
            objectKey: updatedRender.objectKey,
            sizeBytes: updatedRender.sizeBytes,
            checksum: updatedRender.checksum,
            durationSeconds: updatedRender.durationSeconds,
          },
        })
        .where(eq(renderRuns.id, activeRuns[0].id));
    }

    // Update linked job if jobId provided
    if (options?.jobId) {
      const isComplete = update.status === 'READY';
      const isFailed = update.status === 'FAILED';

      await tx
        .update(videoJobs)
        .set({
          status: isComplete ? 'COMPLETED' : isFailed ? 'FAILED' : 'PROCESSING',
          currentStage: isComplete ? 'RENDER_READY' : isFailed ? 'ERROR' : 'RENDERING',
          progress: isComplete ? 100 : isFailed ? 0 : 90,
          errorMessage: options?.errorMessage || null,
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, options.jobId));

      await tx.insert(jobEvents).values({
        id: `evt_rnd_status_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        jobId: options.jobId,
        eventId: `evt_render_${update.status.toLowerCase()}_${renderId}_${Date.now()}`,
        eventType: isComplete ? 'render.completed' : isFailed ? 'render.failed' : 'render.progress',
        stage: isComplete ? 'RENDER_READY' : isFailed ? 'ERROR' : 'RENDERING',
        progress: isComplete ? 100 : isFailed ? 0 : 90,
        message:
          options?.message ||
          (isComplete ? 'تم اكتمال تصيير الفيديو النهائي بنجاح' : 'جاري معالجة الفيديو'),
      });
    }

    return updatedRender;
  });
}

/**
 * Records a render run telemetry entry
 */
export async function recordRenderRunTransaction(
  runData: NewRenderRunRecord
): Promise<RenderRunRecord> {
  const db = getDb();
  const [created] = await db.insert(renderRuns).values(runData).returning();
  return created;
}

/**
 * Gets all render records for a video ordered by version desc
 */
export async function getVideoRenders(videoId: string): Promise<RenderRecord[]> {
  const db = getDb();
  return await db
    .select()
    .from(renders)
    .where(eq(renders.videoId, videoId))
    .orderBy(desc(renders.version));
}

/**
 * Gets the current active/ready render record for a video
 */
export async function getActiveVideoRender(videoId: string): Promise<RenderRecord | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(renders)
    .where(and(eq(renders.videoId, videoId), eq(renders.status, 'READY')))
    .orderBy(desc(renders.version))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Gets a render record by ID
 */
export async function getRenderById(renderId: string): Promise<RenderRecord | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(renders)
    .where(eq(renders.id, renderId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Invalidates all existing READY renders for a video (marks them SUPERSEDED) when source scenes/plan change
 */
export async function invalidateVideoRenders(videoId: string): Promise<void> {
  const db = getDb();
  await db
    .update(renders)
    .set({
      status: 'SUPERSEDED',
      updatedAt: new Date(),
    })
    .where(and(eq(renders.videoId, videoId), eq(renders.status, 'READY')));
}
