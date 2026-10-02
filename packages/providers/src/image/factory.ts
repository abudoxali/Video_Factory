import { assertMockProvidersAllowed } from '@video-factory/contracts';
import type { ImageProvider, ImageProviderConfig } from './types';
import { GeminiImageProvider } from './gemini-image';
import { OpenAiImageProvider } from './openai-image';
import { MockImageProvider } from './mock';

export function createImageProvider(
  providerName?: string,
  config?: ImageProviderConfig
): ImageProvider {
  const name = providerName || process.env.IMAGE_PROVIDER || 'gemini';

  switch (name.toLowerCase()) {
    case 'gemini':
    case 'google':
      return new GeminiImageProvider(config);
    case 'openai':
      return new OpenAiImageProvider(config);
    case 'mock':
    case 'test':
      assertMockProvidersAllowed('image-factory');
      return new MockImageProvider();
    default:
      return new GeminiImageProvider(config);
  }
}
