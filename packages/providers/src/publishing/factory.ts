import {
  isPlaceholderValue,
  isProductionRuntime,
  isTestRuntime,
  type SocialPlatform,
} from '@video-factory/contracts';
import type { PublishingProvider } from './types';
import { YouTubePublishingProvider } from './youtube';
import { InstagramPublishingProvider } from './instagram';
import { TikTokPublishingProvider } from './tiktok';
import { MockPublishingProvider } from './mock';
import { PublishConfigError } from './errors';

export interface PublishingProviderFactoryOptions {
  /** Explicitly request the mock provider — never honored in production. */
  forceMock?: boolean;
}

const PLATFORM_REQUIRED_ENV: Record<SocialPlatform, string[]> = {
  YOUTUBE: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
  INSTAGRAM: ['META_APP_ID', 'META_APP_SECRET'],
  TIKTOK: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
};

function missingPlatformEnv(platform: SocialPlatform): string[] {
  return PLATFORM_REQUIRED_ENV[platform].filter((name) =>
    isPlaceholderValue(process.env[name])
  );
}

export function createPublishingProvider(
  platform: SocialPlatform,
  options?: PublishingProviderFactoryOptions
): PublishingProvider {
  const mockRequested =
    options?.forceMock === true ||
    isTestRuntime() ||
    process.env.VIDEO_FACTORY_USE_MOCK_PROVIDERS === 'true';

  if (mockRequested) {
    // Production must never resolve to a mock provider, even by request.
    if (isProductionRuntime()) {
      throw new PublishConfigError(
        `Mock publishing provider is not allowed in production for platform ${platform}`
      );
    }
    return new MockPublishingProvider(platform);
  }

  const missing = missingPlatformEnv(platform);
  if (missing.length > 0) {
    // Fail closed: never silently substitute a mock provider.
    throw new PublishConfigError(
      `مزود النشر ${platform} غير مكوّن — متغيرات البيئة المطلوبة مفقودة أو غير صالحة: ${missing.join(', ')}`
    );
  }

  switch (platform) {
    case 'YOUTUBE':
      return new YouTubePublishingProvider();
    case 'INSTAGRAM':
      return new InstagramPublishingProvider();
    case 'TIKTOK':
      return new TikTokPublishingProvider();
    default:
      throw new PublishConfigError(`منصة النشر غير مدعومة: ${platform}`);
  }
}
