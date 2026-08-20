import type { SocialPlatform } from '@video-factory/contracts';
import type { PublishingProvider } from './types';
import { YouTubePublishingProvider } from './youtube';
import { InstagramPublishingProvider } from './instagram';
import { TikTokPublishingProvider } from './tiktok';
import { MockPublishingProvider } from './mock';

export function createPublishingProvider(
  platform: SocialPlatform,
  options?: {
    forceMock?: boolean;
  }
): PublishingProvider {
  if (options?.forceMock || process.env.NODE_ENV === 'test') {
    return new MockPublishingProvider(platform);
  }

  switch (platform) {
    case 'YOUTUBE':
      if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
        return new YouTubePublishingProvider();
      }
      return new MockPublishingProvider('YOUTUBE');

    case 'INSTAGRAM':
      if (process.env.META_APP_ID) {
        return new InstagramPublishingProvider();
      }
      return new MockPublishingProvider('INSTAGRAM');

    case 'TIKTOK':
      if (process.env.TIKTOK_CLIENT_KEY) {
        return new TikTokPublishingProvider();
      }
      return new MockPublishingProvider('TIKTOK');

    default:
      return new MockPublishingProvider(platform);
  }
}
