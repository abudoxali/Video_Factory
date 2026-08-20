import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { videos, type Video } from '../schema/videos';
import { videoJobs, type VideoJob } from '../schema/jobs';
import { jobEvents, type JobEvent } from '../schema/events';
import { createId } from '../ids';
import { DEFAULT_USER_ID } from './users';
import { getOrCreateDefaultProject } from './projects';
import type { CreateVideoInput } from '@video-factory/contracts';

export interface CreateVideoTransactionResult {
  video: Video;
  job: VideoJob;
  initialEvent: JobEvent;
}

export async function createVideoWithJobTransaction(
  input: CreateVideoInput,
  userId: string = DEFAULT_USER_ID
): Promise<CreateVideoTransactionResult> {
  const db = getDb();

  // Ensure default project exists if not provided
  let projectId = input.projectId;
  if (!projectId) {
    const defaultProject = await getOrCreateDefaultProject(userId);
    projectId = defaultProject.id;
  }

  const videoId = createId('vid');
  const jobId = createId('job');

  // Derive title from prompt if omitted
  const title =
    input.title?.trim() ||
    input.prompt.slice(0, 40).trim() + (input.prompt.length > 40 ? '...' : '');

  return await db.transaction(async (tx) => {
    // 1. Insert Video
    const [video] = await tx
      .insert(videos)
      .values({
        id: videoId,
        userId,
        projectId,
        title,
        prompt: input.prompt,
        type: input.type,
        durationSeconds: input.durationSeconds,
        language: input.language || 'ar',
        platform: input.platform,
        aspectRatio: input.aspectRatio,
        status: 'QUEUED',
      })
      .returning();

    // 2. Insert Job
    const [job] = await tx
      .insert(videoJobs)
      .values({
        id: jobId,
        videoId,
        status: 'QUEUED',
        progress: 0,
        currentStage: 'RECEIVED',
      })
      .returning();

    // 3. Insert Initial Event
    const [initialEvent] = await tx
      .insert(jobEvents)
      .values({
        id: createId('evt'),
        jobId,
        eventId: `evt_init_${jobId}`,
        eventType: 'JOB_CREATED',
        stage: 'RECEIVED',
        progress: 0,
        message: 'تم استلام طلب إنشاء الفيديو وإدراجه في قائمة الانتظار',
        metadata: {
          platform: input.platform,
          aspectRatio: input.aspectRatio,
          durationSeconds: input.durationSeconds,
        },
      })
      .returning();

    return { video, job, initialEvent };
  });
}

export async function listVideos(options?: {
  userId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const userId = options?.userId || DEFAULT_USER_ID;
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  try {
    const results = await db
      .select({
        video: videos,
        job: videoJobs,
      })
      .from(videos)
      .leftJoin(videoJobs, eq(videoJobs.videoId, videos.id))
      .where(eq(videos.userId, userId))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    return [];
  }
}

export async function getVideoById(id: string): Promise<Video | null> {
  const db = getDb();
  try {
    const rows = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    return null;
  }
}

export async function getDashboardStats(userId: string = DEFAULT_USER_ID) {
  const db = getDb();
  try {
    const allVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));

    const totalVideos = allVideos.length;
    const queuedVideos = allVideos.filter((v) => v.status === 'QUEUED').length;
    const processingVideos = allVideos.filter((v) => v.status === 'PROCESSING').length;
    const completedVideos = allVideos.filter((v) => v.status === 'COMPLETED').length;
    const failedVideos = allVideos.filter((v) => v.status === 'FAILED').length;

    return {
      totalVideos,
      queuedVideos,
      processingVideos,
      completedVideos,
      failedVideos,
      activeJobs: queuedVideos + processingVideos,
    };
  } catch (error) {
    return {
      totalVideos: 0,
      queuedVideos: 0,
      processingVideos: 0,
      completedVideos: 0,
      failedVideos: 0,
      activeJobs: 0,
    };
  }
}
