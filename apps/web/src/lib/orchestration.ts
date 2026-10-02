import crypto from 'crypto';
import {
  CreativeBriefSchema,
  VideoScriptSchema,
  VideoChapterSchema,
  decidePublicationAction,
  isTerminalStatus,
  type CreativeBrief,
  type VideoScript,
  type VideoChapter,
  type JobStatus,
  type JobStage,
  type SocialPlatform,
  type PublicationMetadata,
} from '@video-factory/contracts';
import {
  applyJobCallbackEvent,
  createPhaseJobTransaction,
  getJobWithDetails,
  getRenderById,
  getSocialAccountById,
  updatePublicationStatusTransaction,
  updateSocialAccountStatus,
  type JobEvent,
  type PublicationRecord,
  type RenderRecord,
  type SocialAccountRecord,
  type VideoJob,
} from '@video-factory/database';
import {
  createPublishingProvider,
  createStorageProvider,
  decryptToken,
} from '@video-factory/providers';

/**
 * Internal orchestration helpers shared by the authenticated /api/internal
 * execute endpoints. All state transitions go through the existing
 * transactional DB layer — callers receive real persisted truth.
 */

/** Emit a job event through the same state machine used by n8n callbacks. */
export async function emitPhaseEvent(params: {
  jobId: string;
  eventIdSuffix: string;
  event: string;
  status: JobStatus;
  stage: JobStage | string;
  progress: number;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<JobEvent | void> {
  const result = await applyJobCallbackEvent({
    version: '1.0',
    event_id: `evt_${params.jobId}_${params.eventIdSuffix}`,
    job_id: params.jobId,
    event: params.event,
    status: params.status,
    stage: params.stage,
    progress: params.progress,
    message: params.message,
    metadata: params.metadata,
  });
  if (!result.success) {
    console.warn('[PHASE_EVENT_REJECTED]', params.eventIdSuffix, result.error);
  }
}

/**
 * Resolve the job an internal phase should write against. A provided job_id is
 * honored only when it belongs to the video and is not terminal; otherwise a
 * fresh phase job is minted so progress is never silently dropped.
 */
export async function resolvePhaseJob(params: {
  videoId: string;
  jobId?: string;
  stage: JobStage | string;
  message?: string;
}): Promise<VideoJob> {
  if (params.jobId) {
    const details = await getJobWithDetails(params.jobId);
    if (details?.job && details.job.videoId === params.videoId) {
      if (!isTerminalStatus(details.job.status as JobStatus)) {
        return details.job;
      }
    }
  }
  return await createPhaseJobTransaction({
    videoId: params.videoId,
    stage: String(params.stage),
    message: params.message,
  });
}

/* ------------------------------------------------------------------ */
/* Planning entity → contract mappers (for single-stage re-execution)  */
/* ------------------------------------------------------------------ */

export function briefEntityToContract(
  brief: {
    id: string;
    videoId: string;
    workingTitle: string;
    coreIdea: string;
    objective: string;
    targetAudience: string;
    tone: string;
    contentAngle: string;
    hookStrategy: string;
    narrativeStyle: string;
    visualDirection: string;
    pacing: string | null;
    callToAction: string | null;
    keyPoints: unknown;
    constraints: unknown;
    planningNotes: string | null;
    requiresResearch: boolean | null;
    status: string;
    version: number;
  },
  video: {
    platform: string;
    type: string;
    durationSeconds: number;
    language: string;
  }
): CreativeBrief {
  return CreativeBriefSchema.parse({
    id: brief.id,
    videoId: brief.videoId,
    workingTitle: brief.workingTitle,
    coreIdea: brief.coreIdea,
    objective: brief.objective,
    targetAudience: brief.targetAudience,
    platform: video.platform,
    videoType: video.type,
    targetDurationSeconds: video.durationSeconds,
    language: video.language || 'ar',
    tone: brief.tone,
    contentAngle: brief.contentAngle,
    hookStrategy: brief.hookStrategy,
    narrativeStyle: brief.narrativeStyle,
    visualDirection: brief.visualDirection,
    pacing: brief.pacing || 'moderate',
    callToAction: brief.callToAction || undefined,
    keyPoints: Array.isArray(brief.keyPoints) ? brief.keyPoints : [],
    constraints: Array.isArray(brief.constraints) ? brief.constraints : [],
    planningNotes: brief.planningNotes || undefined,
    requiresResearch: brief.requiresResearch || false,
    status: 'READY_FOR_REVIEW',
    version: brief.version || 1,
  });
}

export function scriptEntityToContract(script: {
  id: string;
  videoId: string;
  briefId: string | null;
  title: string;
  hook: string;
  sections: unknown;
  fullNarration: string;
  estimatedWordCount: number;
  estimatedDurationSeconds: number;
  language: string | null;
  callToAction: string | null;
  scriptVersion: number;
}): VideoScript {
  return VideoScriptSchema.parse({
    id: script.id,
    videoId: script.videoId,
    briefId: script.briefId || undefined,
    title: script.title,
    hook: script.hook,
    sections: Array.isArray(script.sections) ? script.sections : [],
    fullNarration: script.fullNarration,
    estimatedWordCount: script.estimatedWordCount,
    estimatedDurationSeconds: script.estimatedDurationSeconds,
    language: script.language || 'ar',
    callToAction: script.callToAction || undefined,
    scriptVersion: script.scriptVersion || 1,
    status: 'READY_FOR_REVIEW',
  });
}

export function chapterEntityToContract(chapter: {
  id: string;
  videoId: string;
  position: number;
  title: string;
  purpose: string;
  summary: string;
  targetDurationSeconds: number;
  scriptText: string | null;
}): VideoChapter {
  return VideoChapterSchema.parse({
    id: chapter.id,
    videoId: chapter.videoId,
    position: chapter.position,
    title: chapter.title,
    purpose: chapter.purpose,
    summary: chapter.summary,
    targetDurationSeconds: chapter.targetDurationSeconds,
    scriptText: chapter.scriptText || undefined,
  });
}

/* ------------------------------------------------------------------ */
/* Publishing drive — the single real path to the provider layer       */
/* ------------------------------------------------------------------ */

/**
 * Deterministic idempotency key: re-dispatching the same (user, video, render,
 * platform) tuple always maps to the same publication record, so retries can
 * never create duplicate social posts.
 */
export function buildPublishIdempotencyKey(params: {
  userId: string;
  videoId: string;
  renderId: string;
  platform: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      `${params.userId}:${params.videoId}:${params.renderId}:${params.platform.toUpperCase()}`
    )
    .digest('hex');
}

export interface PublicationDriveResult {
  publicationId: string;
  platform: SocialPlatform;
  action: 'publish' | 'reconcile_status' | 'skipped';
  success: boolean;
  status: string;
  platformUrl?: string | null;
  platformPublicationId?: string | null;
  skippedReason?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Drives a single publication through the real provider boundary.
 * - PUBLISHED records are returned untouched (idempotent).
 * - In-flight records with a platformPublicationId are reconciled via
 *   provider.getStatus — no duplicate submission.
 * - QUEUED/FAILED records are (re)submitted via provider.publish with the
 *   persisted idempotencyKey.
 * - Disabled platforms are skipped explicitly; missing credentials fail closed.
 */
export async function drivePublication(
  publication: PublicationRecord
): Promise<PublicationDriveResult> {
  const platform = publication.platform as SocialPlatform;
  const base: PublicationDriveResult = {
    publicationId: publication.id,
    platform,
    action: 'skipped',
    success: false,
    status: publication.status,
    platformUrl: publication.platformUrl,
    platformPublicationId: publication.platformPublicationId,
  };

  const action = decidePublicationAction({
    status: publication.status,
    platformPublicationId: publication.platformPublicationId,
  });

  if (action === 'skip_published') {
    return { ...base, success: true, skippedReason: 'ALREADY_PUBLISHED' };
  }
  if (action === 'skip_cancelled') {
    return { ...base, success: true, skippedReason: 'CANCELLED' };
  }

  // Render must be READY with a persisted object — never publish without it.
  const render: RenderRecord | null = await getRenderById(publication.renderId);
  if (!render || render.status !== 'READY' || !render.objectKey) {
    await updatePublicationStatusTransaction(
      publication.id,
      { status: 'FAILED' },
      {
        errorCode: 'PUBLISH_INVALID_MEDIA',
        errorMessage: 'لا يوجد إخراج نهائي READY مرتبط بهذا المنشور',
      }
    );
    return {
      ...base,
      status: 'FAILED',
      errorCode: 'PUBLISH_INVALID_MEDIA',
      errorMessage: 'Render is not READY or has no persisted object',
    };
  }

  const account: SocialAccountRecord | null = await getSocialAccountById(
    publication.socialAccountId
  );
  if (!account || account.status !== 'CONNECTED') {
    await updatePublicationStatusTransaction(
      publication.id,
      { status: 'REQUIRES_REAUTH' },
      { errorCode: 'PUBLISH_AUTH_REQUIRED', errorMessage: 'الحساب غير متصل' }
    );
    return {
      ...base,
      status: 'REQUIRES_REAUTH',
      errorCode: 'PUBLISH_AUTH_REQUIRED',
      errorMessage: 'Social account is not connected',
    };
  }

  let accessToken = '';
  try {
    accessToken = decryptToken(account.accessTokenEncrypted);
  } catch {
    await updatePublicationStatusTransaction(
      publication.id,
      { status: 'REQUIRES_REAUTH' },
      { errorCode: 'PUBLISH_TOKEN_EXPIRED', errorMessage: 'فشل فك تشفير رمز الوصول' }
    );
    await updateSocialAccountStatus(account.id, 'ERROR', {
      reason: 'token_decrypt_failed',
    }).catch(() => undefined);
    return {
      ...base,
      status: 'REQUIRES_REAUTH',
      errorCode: 'PUBLISH_TOKEN_EXPIRED',
      errorMessage: 'Failed to decrypt social account token',
    };
  }

  // Provider resolution fails closed when credentials are missing.
  const provider = createPublishingProvider(platform);
  const storage = createStorageProvider(render.storageProvider || 'r2');
  const presigned = await storage.getSignedReadUrl(
    render.objectKey,
    7200,
    render.bucket || undefined
  );
  const metadata = (publication.metadataJson || {}) as PublicationMetadata;

  if (action === 'reconcile_status') {
    const statusResult = await provider.getStatus({
      publicationId: publication.id,
      platformPublicationId: publication.platformPublicationId!,
      account: { accessToken },
      metadata: metadata as Record<string, unknown>,
    });

    if (statusResult.status !== publication.status) {
      await updatePublicationStatusTransaction(
        publication.id,
        {
          status: statusResult.status,
          platformUrl: statusResult.platformUrl,
        },
        {
          errorCode: statusResult.errorCode,
          errorMessage: statusResult.errorMessage,
          metadata: { rawStatus: statusResult.rawStatus },
        }
      );
    }

    return {
      ...base,
      action: 'reconcile_status',
      success: statusResult.status !== 'FAILED',
      status: statusResult.status,
      platformUrl: statusResult.platformUrl ?? publication.platformUrl,
      errorCode: statusResult.errorCode,
      errorMessage: statusResult.errorMessage,
    };
  }

  // action === 'publish' — mark in-flight, then submit to the real provider.
  if (publication.status !== 'UPLOADING') {
    await updatePublicationStatusTransaction(
      publication.id,
      { status: 'UPLOADING', startedAt: new Date() },
      { metadata: { redrive: publication.status === 'FAILED' } }
    );
  }

  const submission = await provider.publish({
    publicationId: publication.id,
    videoId: publication.videoId,
    renderId: publication.renderId,
    userId: publication.userId,
    account: {
      id: account.id,
      platformUserId: account.platformUserId,
      accessToken,
    },
    metadata,
    video: {
      r2ObjectKey: render.objectKey,
      r2Bucket: render.bucket || undefined,
      videoUrl: presigned.url,
      sizeBytes: Number(render.sizeBytes || 0),
      durationSeconds: parseFloat(render.durationSeconds || '5'),
      width: render.width,
      height: render.height,
      mimeType: render.mimeType || 'video/mp4',
    },
    idempotencyKey: publication.idempotencyKey,
  });

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

  return {
    ...base,
    action: 'publish',
    success: submission.success,
    status: submission.status,
    platformUrl: submission.platformUrl,
    platformPublicationId: submission.platformPublicationId ?? publication.platformPublicationId,
    errorCode: submission.errorCode,
    errorMessage: submission.errorMessage,
  };
}
