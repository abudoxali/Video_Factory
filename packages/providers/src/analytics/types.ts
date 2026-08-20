import type { SocialPlatform } from '@video-factory/contracts';

export interface FetchAnalyticsRequest {
  publicationId: string;
  platform: SocialPlatform;
  platformPublicationId: string;
  account: {
    accessToken: string;
    platformUserId?: string;
  };
}

export interface NormalizedAnalyticsSnapshot {
  publicationId: string;
  platform: SocialPlatform;
  capturedAt: Date;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  watchTimeSeconds: number | null;
  averageViewDurationSeconds: number | null;
  followersGained: number | null;
  rawSupportedMetrics: Record<string, unknown>;
}

export interface AnalyticsProvider {
  readonly platform: SocialPlatform;
  fetchPublicationAnalytics(request: FetchAnalyticsRequest): Promise<NormalizedAnalyticsSnapshot>;
}
