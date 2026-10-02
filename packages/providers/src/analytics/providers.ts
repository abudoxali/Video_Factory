import type { AnalyticsProvider, FetchAnalyticsRequest, NormalizedAnalyticsSnapshot } from './types';
import {
  isPlaceholderValue,
  isProductionRuntime,
  isTestRuntime,
  ProductionConfigError,
  type SocialPlatform,
} from '@video-factory/contracts';

export class YouTubeAnalyticsProvider implements AnalyticsProvider {
  public readonly platform: SocialPlatform = 'YOUTUBE';

  public async fetchPublicationAnalytics(
    request: FetchAnalyticsRequest
  ): Promise<NormalizedAnalyticsSnapshot> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${request.platformPublicationId}`,
        {
          headers: { Authorization: `Bearer ${request.account.accessToken}` },
        }
      );

      if (!response.ok) {
        throw new Error('فشل جلب إحصاءات يوتيوب');
      }

      const data = await response.json();
      const stats = data.items?.[0]?.statistics || {};

      return {
        publicationId: request.publicationId,
        platform: 'YOUTUBE',
        capturedAt: new Date(),
        views: stats.viewCount !== undefined ? parseInt(stats.viewCount, 10) : null,
        likes: stats.likeCount !== undefined ? parseInt(stats.likeCount, 10) : null,
        comments: stats.commentCount !== undefined ? parseInt(stats.commentCount, 10) : null,
        shares: null, // Not exposed via basic videos.list
        watchTimeSeconds: null, // Requires YouTube Analytics reporting API
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: stats,
      };
    } catch (err: unknown) {
      return {
        publicationId: request.publicationId,
        platform: 'YOUTUBE',
        capturedAt: new Date(),
        views: null,
        likes: null,
        comments: null,
        shares: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: { error: (err as Error).message },
      };
    }
  }
}

export class InstagramInsightsProvider implements AnalyticsProvider {
  public readonly platform: SocialPlatform = 'INSTAGRAM';
  private readonly apiVersion: string;

  constructor(apiVersion = 'v22.0') {
    this.apiVersion = apiVersion;
  }

  public async fetchPublicationAnalytics(
    request: FetchAnalyticsRequest
  ): Promise<NormalizedAnalyticsSnapshot> {
    try {
      const mediaId = request.platformPublicationId;
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${mediaId}/insights?metric=reach,saved,shares,comments,likes,total_interactions&access_token=${request.account.accessToken}`
      );

      if (!res.ok) {
        throw new Error('فشل جلب إحصاءات إنستغرام');
      }

      const data = await res.json();
      const metricsMap: Record<string, number> = {};

      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          const val = item.values?.[0]?.value ?? item.total_value?.value;
          if (val !== undefined) {
            metricsMap[item.name] = val;
          }
        }
      }

      return {
        publicationId: request.publicationId,
        platform: 'INSTAGRAM',
        capturedAt: new Date(),
        views: metricsMap.reach !== undefined ? metricsMap.reach : null,
        likes: metricsMap.likes !== undefined ? metricsMap.likes : null,
        comments: metricsMap.comments !== undefined ? metricsMap.comments : null,
        shares: metricsMap.shares !== undefined ? metricsMap.shares : null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: metricsMap,
      };
    } catch (err: unknown) {
      return {
        publicationId: request.publicationId,
        platform: 'INSTAGRAM',
        capturedAt: new Date(),
        views: null,
        likes: null,
        comments: null,
        shares: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: { error: (err as Error).message },
      };
    }
  }
}

export class TikTokAnalyticsProvider implements AnalyticsProvider {
  public readonly platform: SocialPlatform = 'TIKTOK';

  public async fetchPublicationAnalytics(
    request: FetchAnalyticsRequest
  ): Promise<NormalizedAnalyticsSnapshot> {
    try {
      const res = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,like_count,comment_count,share_count,view_count', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.account.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {
            video_ids: [request.platformPublicationId],
          },
        }),
      });

      if (!res.ok) {
        throw new Error('فشل جلب إحصاءات تيك توك');
      }

      const data = await res.json();
      const video = data.data?.videos?.[0] || {};

      return {
        publicationId: request.publicationId,
        platform: 'TIKTOK',
        capturedAt: new Date(),
        views: video.view_count !== undefined ? video.view_count : null,
        likes: video.like_count !== undefined ? video.like_count : null,
        comments: video.comment_count !== undefined ? video.comment_count : null,
        shares: video.share_count !== undefined ? video.share_count : null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: video,
      };
    } catch (err: unknown) {
      return {
        publicationId: request.publicationId,
        platform: 'TIKTOK',
        capturedAt: new Date(),
        views: null,
        likes: null,
        comments: null,
        shares: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
        followersGained: null,
        rawSupportedMetrics: { error: (err as Error).message },
      };
    }
  }
}

export class MockAnalyticsProvider implements AnalyticsProvider {
  public readonly platform: SocialPlatform;

  constructor(platform: SocialPlatform = 'YOUTUBE') {
    this.platform = platform;
  }

  public async fetchPublicationAnalytics(
    request: FetchAnalyticsRequest
  ): Promise<NormalizedAnalyticsSnapshot> {
    return {
      publicationId: request.publicationId,
      platform: this.platform,
      capturedAt: new Date(),
      views: 1420,
      likes: 285,
      comments: 34,
      shares: 18,
      watchTimeSeconds: 4260,
      averageViewDurationSeconds: 24.5,
      followersGained: 12,
      rawSupportedMetrics: { mock: true },
    };
  }
}

const ANALYTICS_REQUIRED_ENV: Record<SocialPlatform, string[]> = {
  YOUTUBE: ['GOOGLE_OAUTH_CLIENT_ID'],
  INSTAGRAM: ['META_APP_ID'],
  TIKTOK: ['TIKTOK_CLIENT_KEY'],
};

export function createAnalyticsProvider(
  platform: SocialPlatform,
  options?: { forceMock?: boolean }
): AnalyticsProvider {
  const mockRequested =
    options?.forceMock === true ||
    isTestRuntime() ||
    process.env.VIDEO_FACTORY_USE_MOCK_PROVIDERS === 'true';

  if (mockRequested) {
    if (isProductionRuntime()) {
      throw new ProductionConfigError(
        `Mock analytics provider is not allowed in production for platform ${platform}`
      );
    }
    return new MockAnalyticsProvider(platform);
  }

  const missing = ANALYTICS_REQUIRED_ENV[platform].filter((name) =>
    isPlaceholderValue(process.env[name])
  );
  if (missing.length > 0) {
    throw new ProductionConfigError(
      `Analytics provider for ${platform} is not configured — missing/invalid env: ${missing.join(', ')}`
    );
  }

  switch (platform) {
    case 'YOUTUBE':
      return new YouTubeAnalyticsProvider();
    case 'INSTAGRAM':
      return new InstagramInsightsProvider();
    case 'TIKTOK':
      return new TikTokAnalyticsProvider();
    default:
      throw new ProductionConfigError(`Unsupported analytics platform: ${platform}`);
  }
}
