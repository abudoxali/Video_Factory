import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from '../client';
import { publications, type PublicationRecord, type NewPublicationRecord } from '../schema/publications';
import { publicationAttempts, type PublicationAttemptRecord, type NewPublicationAttemptRecord } from '../schema/publication-attempts';
import { videos } from '../schema/videos';
import { renders } from '../schema/renders';
import { socialAccounts } from '../schema/social-accounts';

export interface CreatePublicationInput {
  id?: string;
  videoId: string;
  renderId: string;
  socialAccountId: string;
  userId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  status?: string;
  metadataJson: Record<string, unknown>;
  idempotencyKey: string;
  scheduledAt?: Date | null;
}

/**
 * Creates a publication record with idempotency verification and ownership checks
 */
export async function createPublicationTransaction(
  input: CreatePublicationInput
): Promise<{ publication: PublicationRecord; isDuplicate: boolean }> {
  const db = getDb();
  const publicationId = input.id || `pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await db.transaction(async (tx: any) => {
    // 1. Idempotency Check: if identical idempotencyKey exists for this user, return existing
    const existing = await tx
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.userId, input.userId),
          eq(publications.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { publication: existing[0], isDuplicate: true };
    }

    // 2. Ownership Verification: verify user owns video, render, and social account
    const [video] = await tx
      .select({ id: videos.id, userId: videos.userId })
      .from(videos)
      .where(eq(videos.id, input.videoId))
      .limit(1);

    if (!video || video.userId !== input.userId) {
      throw new Error('غير مصرح لك بنشر هذا الفيديو (فشل التحقق من الملكية)');
    }

    const [render] = await tx
      .select({ id: renders.id, status: renders.status })
      .from(renders)
      .where(eq(renders.id, input.renderId))
      .limit(1);

    if (!render || render.status !== 'READY') {
      throw new Error('الفيديو المراد نشره غير جاهز أو غير موجود (يجب أن تكون حالة الإخراج READY)');
    }

    const [account] = await tx
      .select({ id: socialAccounts.id, status: socialAccounts.status, userId: socialAccounts.userId })
      .from(socialAccounts)
      .where(eq(socialAccounts.id, input.socialAccountId))
      .limit(1);

    if (!account || account.userId !== input.userId || account.status !== 'CONNECTED') {
      throw new Error('حساب التواصل المحدد غير متصل أو غير مملوك للمستخدم');
    }

    // 3. Create publication record
    const [createdPub] = await tx
      .insert(publications)
      .values({
        id: publicationId,
        videoId: input.videoId,
        renderId: input.renderId,
        socialAccountId: input.socialAccountId,
        userId: input.userId,
        platform: input.platform,
        status: input.status || 'QUEUED',
        metadataJson: input.metadataJson,
        idempotencyKey: input.idempotencyKey,
        scheduledAt: input.scheduledAt,
        startedAt: input.status === 'PUBLISHING' || input.status === 'UPLOADING' ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 4. Create initial attempt audit record
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await tx.insert(publicationAttempts).values({
      id: attemptId,
      publicationId: createdPub.id,
      attempt: 1,
      provider: input.platform.toLowerCase(),
      status: createdPub.status,
      startedAt: new Date(),
    });

    return { publication: createdPub, isDuplicate: false };
  });
}

/**
 * Updates publication status, platform URL, and records attempt completion atomically
 */
export async function updatePublicationStatusTransaction(
  publicationId: string,
  update: {
    status: string;
    platformPublicationId?: string | null;
    platformUrl?: string | null;
    startedAt?: Date;
    publishedAt?: Date;
  },
  options?: {
    attempt?: number;
    providerRequestId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    latencyMs?: number | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<PublicationRecord | null> {
  const db = getDb();

  return await db.transaction(async (tx: any) => {
    const existing = await tx
      .select()
      .from(publications)
      .where(eq(publications.id, publicationId))
      .limit(1);

    if (existing.length === 0) return null;

    const [updated] = await tx
      .update(publications)
      .set({
        status: update.status,
        platformPublicationId:
          update.platformPublicationId !== undefined
            ? update.platformPublicationId
            : existing[0].platformPublicationId,
        platformUrl:
          update.platformUrl !== undefined ? update.platformUrl : existing[0].platformUrl,
        startedAt: update.startedAt !== undefined ? update.startedAt : existing[0].startedAt,
        publishedAt:
          update.status === 'PUBLISHED'
            ? update.publishedAt || new Date()
            : existing[0].publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(publications.id, publicationId))
      .returning();

    // Log attempt record
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await tx.insert(publicationAttempts).values({
      id: attemptId,
      publicationId,
      attempt: options?.attempt || 1,
      provider: updated.platform.toLowerCase(),
      status: update.status,
      startedAt: existing[0].startedAt || new Date(),
      completedAt: update.status === 'PUBLISHED' || update.status === 'FAILED' ? new Date() : null,
      latencyMs: options?.latencyMs,
      providerRequestId: options?.providerRequestId,
      errorCode: options?.errorCode,
      errorMessage: options?.errorMessage,
      metadata: options?.metadata,
      createdAt: new Date(),
    });

    return updated;
  });
}

/**
 * Gets all publications for a video with optional user ownership check
 */
export async function getVideoPublications(
  videoId: string,
  userId?: string
): Promise<PublicationRecord[]> {
  const db = getDb();
  const conditions = [eq(publications.videoId, videoId)];
  if (userId) {
    conditions.push(eq(publications.userId, userId));
  }

  return await db
    .select()
    .from(publications)
    .where(and(...conditions))
    .orderBy(desc(publications.createdAt));
}

/**
 * Gets a specific publication by ID
 */
export async function getPublicationById(
  publicationId: string,
  userId?: string
): Promise<PublicationRecord | null> {
  const db = getDb();
  const conditions = [eq(publications.id, publicationId)];
  if (userId) {
    conditions.push(eq(publications.userId, userId));
  }

  const results = await db
    .select()
    .from(publications)
    .where(and(...conditions))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Gets pending publications stuck in intermediate states for reconciliation
 */
export async function getPendingPublicationsToReconcile(): Promise<PublicationRecord[]> {
  const db = getDb();
  return await db
    .select()
    .from(publications)
    .where(
      inArray(publications.status, ['UPLOADING', 'PROCESSING', 'PUBLISHING', 'QUEUED'])
    )
    .orderBy(publications.updatedAt)
    .limit(50);
}

/**
 * Gets published publications for telemetry sync
 */
export async function getPublishedPublications(limit = 50): Promise<PublicationRecord[]> {
  const db = getDb();
  return await db
    .select()
    .from(publications)
    .where(eq(publications.status, 'PUBLISHED'))
    .orderBy(desc(publications.updatedAt))
    .limit(limit);
}

/**
 * Cancels a queued publication
 */
export async function cancelPublication(
  publicationId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(publications)
    .set({
      status: 'CANCELLED',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publications.id, publicationId),
        eq(publications.userId, userId),
        inArray(publications.status, ['DRAFT', 'QUEUED'])
      )
    )
    .returning();

  return result.length > 0;
}
