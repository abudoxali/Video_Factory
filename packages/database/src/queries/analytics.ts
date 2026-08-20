import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../client';
import { analyticsSnapshots, type AnalyticsSnapshotRecord, type NewAnalyticsSnapshotRecord } from '../schema/analytics-snapshots';
import { publications } from '../schema/publications';

export interface RecordAnalyticsSnapshotInput {
  id?: string;
  publicationId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  capturedAt?: Date;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  watchTimeSeconds?: string | null;
  averageViewDurationSeconds?: string | null;
  followersGained?: number | null;
  rawSupportedMetrics?: Record<string, unknown>;
}

/**
 * Records an analytics snapshot for a publication
 */
export async function recordAnalyticsSnapshot(
  input: RecordAnalyticsSnapshotInput
): Promise<AnalyticsSnapshotRecord> {
  const db = getDb();
  const snapshotId = input.id || `snp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const [created] = await db
    .insert(analyticsSnapshots)
    .values({
      id: snapshotId,
      publicationId: input.publicationId,
      platform: input.platform,
      capturedAt: input.capturedAt || new Date(),
      views: input.views,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      watchTimeSeconds: input.watchTimeSeconds,
      averageViewDurationSeconds: input.averageViewDurationSeconds,
      followersGained: input.followersGained,
      rawSupportedMetrics: input.rawSupportedMetrics || {},
      createdAt: new Date(),
    })
    .returning();

  return created;
}

/**
 * Gets all analytics snapshots for a publication ordered by capturedAt desc
 */
export async function getPublicationAnalytics(
  publicationId: string
): Promise<AnalyticsSnapshotRecord[]> {
  const db = getDb();
  return await db
    .select()
    .from(analyticsSnapshots)
    .where(eq(analyticsSnapshots.publicationId, publicationId))
    .orderBy(desc(analyticsSnapshots.capturedAt));
}

/**
 * Gets the latest analytics snapshot for a publication
 */
export async function getLatestPublicationAnalytics(
  publicationId: string
): Promise<AnalyticsSnapshotRecord | null> {
  const db = getDb();
  const results = await db
    .select()
    .from(analyticsSnapshots)
    .where(eq(analyticsSnapshots.publicationId, publicationId))
    .orderBy(desc(analyticsSnapshots.capturedAt))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Gets the consolidated latest analytics for all publications of a video
 */
export async function getVideoAnalyticsSummary(
  videoId: string,
  userId?: string
): Promise<Array<{ publication: any; latestSnapshot: AnalyticsSnapshotRecord | null }>> {
  const db = getDb();
  const conditions = [eq(publications.videoId, videoId)];
  if (userId) {
    conditions.push(eq(publications.userId, userId));
  }

  const pubs = await db
    .select()
    .from(publications)
    .where(and(...conditions))
    .orderBy(desc(publications.createdAt));

  const summary = [];
  for (const pub of pubs) {
    const latest = await getLatestPublicationAnalytics(pub.id);
    summary.push({
      publication: pub,
      latestSnapshot: latest,
    });
  }

  return summary;
}
