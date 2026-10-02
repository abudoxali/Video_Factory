import { assertMockProvidersAllowed } from '@video-factory/contracts';
import type { VideoProvider, VideoProviderConfig } from './types';
import { GoogleVideoProvider } from './google-video';
import { MockVideoProvider } from './mock';

export function createVideoProvider(
  providerName?: string,
  config?: VideoProviderConfig
): VideoProvider {
  const name = providerName || process.env.VIDEO_PROVIDER || 'google';

  switch (name.toLowerCase()) {
    case 'google':
    case 'gemini':
    case 'veo':
      return new GoogleVideoProvider(config);
    case 'mock':
    case 'test':
      assertMockProvidersAllowed('video-factory');
      return new MockVideoProvider();
    default:
      return new GoogleVideoProvider(config);
  }
}
