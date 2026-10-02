import { eq, desc, asc } from 'drizzle-orm';
import { getDb } from '../client';
import { videoJobs, type VideoJob } from '../schema/jobs';
import { videos, type Video } from '../schema/videos';
import { jobEvents, type JobEvent } from '../schema/events';
import { createId } from '../ids';
import {
  canTransitionStatus,
  type JobStatus,
  type N8nCallbackPayload,
} from '@video-factory/contracts';

export interface JobWithDetails {
  job: VideoJob;
  video: Video | null;
  events: JobEvent[];
}

export async function getJobWithDetails(jobId: string): Promise<JobWithDetails | null> {
  const db = getDb();
  try {
    const jobRows = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.id, jobId))
      .limit(1);

    if (!jobRows || jobRows.length === 0 || !jobRows[0]) {
      return null;
    }

    const job = jobRows[0];

    const videoRows = await db
      .select()
      .from(videos)
      .where(eq(videos.id, job.videoId))
      .limit(1);

    const video = videoRows[0] || null;

    const events = await db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, jobId))
      .orderBy(asc(jobEvents.createdAt));

    return {
      job,
      video,
      events,
    };
  } catch (error) {
    return null;
  }
}

export async function listRecentJobs(limit: number = 10) {
  const db = getDb();
  try {
    const rows = await db
      .select({
        job: videoJobs,
        video: videos,
      })
      .from(videoJobs)
      .innerJoin(videos, eq(videos.id, videoJobs.videoId))
      .orderBy(desc(videoJobs.createdAt))
      .limit(limit);

    return rows;
  } catch (error) {
    return [];
  }
}

export interface CallbackResult {
  success: boolean;
  idempotent?: boolean;
  job?: VideoJob;
  error?: string;
}

export async function applyJobCallbackEvent(
  payload: N8nCallbackPayload
): Promise<CallbackResult> {
  const db = getDb();

  // 1. Idempotency check: Check if event_id has already been processed
  const existingEvent = await db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.eventId, payload.event_id))
    .limit(1);

  if (existingEvent && existingEvent.length > 0) {
    const currentJob = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.id, payload.job_id))
      .limit(1);

    return {
      success: true,
      idempotent: true,
      job: currentJob[0],
    };
  }

  // 2. Fetch current job
  const jobRows = await db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.id, payload.job_id))
    .limit(1);

  if (!jobRows || jobRows.length === 0 || !jobRows[0]) {
    return {
      success: false,
      error: 'JOB_NOT_FOUND',
    };
  }

  const currentJob = jobRows[0];
  const currentStatus = currentJob.status as JobStatus;
  const newStatus = payload.status as JobStatus;

  // 3. State machine transition validation
  if (!canTransitionStatus(currentStatus, newStatus)) {
    return {
      success: false,
      error: `INVALID_STATE_TRANSITION: Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // 4. Atomic transaction to update job, video, and append event
  return await db.transaction(async (tx) => {
    const startedAt =
      currentJob.startedAt || (newStatus === 'PROCESSING' ? new Date() : null);

    const completedAt =
      newStatus === 'COMPLETED' || newStatus === 'FAILED' || newStatus === 'CANCELLED'
        ? new Date()
        : null;

    const [updatedJob] = await tx
      .update(videoJobs)
      .set({
        status: newStatus,
        progress: payload.progress,
        currentStage: payload.stage,
        startedAt,
        completedAt,
        errorCode: newStatus === 'FAILED' ? 'N8N_WORKFLOW_FAILED' : null,
        errorMessage: newStatus === 'FAILED' ? (payload.message || 'فشلت معالجة المهمة') : null,
        updatedAt: new Date(),
      })
      .where(eq(videoJobs.id, payload.job_id))
      .returning();

    await tx
      .update(videos)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, currentJob.videoId));

    await tx.insert(jobEvents).values({
      id: createId('evt'),
      jobId: payload.job_id,
      eventId: payload.event_id,
      eventType: payload.event,
      stage: payload.stage,
      progress: payload.progress,
      message: payload.message || null,
      metadata: payload.metadata || null,
    });

    return {
      success: true,
      idempotent: false,
      job: updatedJob,
    };
  });
}

/**
 * Creates a dedicated phase job (MEDIA_PREPARATION / RENDER_PREPARATION /
 * PUBLISHING) for a video whose initial planning job has already completed.
 * Used by internal orchestration endpoints so downstream phases keep a real,
 * append-only job/event trail instead of writing against a terminal job.
 */
export async function createPhaseJobTransaction(params: {
  videoId: string;
  stage: string;
  progress?: number;
  message?: string;
}): Promise<VideoJob> {
  const db = getDb();
  const jobId = createId('job');

  return await db.transaction(async (tx) => {
    const [job] = await tx
      .insert(videoJobs)
      .values({
        id: jobId,
        videoId: params.videoId,
        status: 'PROCESSING',
        progress: params.progress ?? 0,
        currentStage: params.stage,
        startedAt: new Date(),
      })
      .returning();

    await tx
      .update(videos)
      .set({ status: 'PROCESSING', updatedAt: new Date() })
      .where(eq(videos.id, params.videoId));

    await tx.insert(jobEvents).values({
      id: createId('evt'),
      jobId,
      eventId: `evt_phase_${params.stage.toLowerCase()}_${jobId}`,
      eventType: 'PHASE_STARTED',
      stage: params.stage,
      progress: params.progress ?? 0,
      message: params.message || `بدء مرحلة ${params.stage}`,
      metadata: { phase: params.stage },
    });

    return job;
  });
}

export async function appendDiagnosticJobEvent(params: {
  jobId: string;
  eventType: string;
  stage: string;
  progress: number;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  try {
    const [event] = await db
      .insert(jobEvents)
      .values({
        id: createId('evt'),
        jobId: params.jobId,
        eventId: `evt_diag_${Date.now()}_${createId('evt')}`,
        eventType: params.eventType,
        stage: params.stage,
        progress: params.progress,
        message: params.message,
        metadata: params.metadata || null,
      })
      .returning();

    return event;
  } catch (error) {
    return null;
  }
}
