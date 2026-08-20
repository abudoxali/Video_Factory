import type { ImageProvider } from './types';
import type { ImageGenerationRequest, ImageGenerationResult } from '@video-factory/contracts';

// A minimal valid 1x1 transparent PNG buffer for tests
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export class MockImageProvider implements ImageProvider {
  public readonly name = 'mock-image';
  public readonly defaultModel: string = 'mock-nano-banana';
  public shouldFail = false;

  public async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        model: this.defaultModel,
        latencyMs: 10,
        error: {
          code: 'MEDIA_PROVIDER_ERROR',
          message: 'فشل محاكي توليد الصور للاختبار',
        },
      };
    }

    const buffer = Buffer.from(TINY_PNG_BASE64, 'base64');
    const isPortrait = request.aspectRatio === '9:16';

    return {
      success: true,
      provider: this.name,
      model: this.defaultModel,
      mimeType: 'image/png',
      buffer,
      width: isPortrait ? 768 : 1344,
      height: isPortrait ? 1344 : 768,
      latencyMs: 15,
      usageMetadata: { sampleCount: 1 },
    };
  }
}
