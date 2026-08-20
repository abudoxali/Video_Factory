import type { ImageProvider, ImageProviderConfig } from './types';
import type { ImageGenerationRequest, ImageGenerationResult, MediaErrorCode } from '@video-factory/contracts';

export class OpenAiImageProvider implements ImageProvider {
  public readonly name = 'openai-image';
  public readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: ImageProviderConfig) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = config?.defaultModel || process.env.IMAGE_MODEL || 'gpt-image-2';
    this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
    this.timeoutMs = config?.timeoutMs || 60000;
  }

  public async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        model,
        latencyMs: 0,
        error: {
          code: 'MEDIA_AUTH_ERROR',
          message: 'مفتاح واجهة برمجة تطبيقات OpenAI للصور غير متوفر',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/images/generations`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const isPortrait = request.aspectRatio === '9:16' || request.aspectRatio === 'vertical';
      const size = isPortrait ? '1024x1792' : '1792x1024';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: model === 'gpt-image-2' ? 'dall-e-3' : model,
          prompt: request.prompt,
          n: 1,
          size,
          response_format: 'b64_json',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorCode: MediaErrorCode = 'MEDIA_PROVIDER_ERROR';

        if (response.status === 401 || response.status === 403) {
          errorCode = 'MEDIA_AUTH_ERROR';
        } else if (response.status === 429) {
          errorCode = 'MEDIA_RATE_LIMIT';
        }

        return {
          success: false,
          provider: this.name,
          model,
          latencyMs,
          error: {
            code: errorCode,
            message: `فشل توليد الصورة من OpenAI HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          },
        };
      }

      const data = await response.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) {
        return {
          success: false,
          provider: this.name,
          model,
          latencyMs,
          error: {
            code: 'MEDIA_VALIDATION_ERROR',
            message: 'لم يتم إرجاع أي بايتات صورة من OpenAI',
          },
        };
      }

      const buffer = Buffer.from(b64, 'base64');
      const width = isPortrait ? 1024 : 1792;
      const height = isPortrait ? 1792 : 1024;

      return {
        success: true,
        provider: this.name,
        model,
        mimeType: 'image/png',
        buffer,
        width,
        height,
        latencyMs,
      };
    } catch (error: unknown) {
      const err = error as Error;
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';

      return {
        success: false,
        provider: this.name,
        model,
        latencyMs,
        error: {
          code: isTimeout ? 'MEDIA_TIMEOUT' : 'MEDIA_PROVIDER_ERROR',
          message: isTimeout ? 'انتهت المهلة' : `خطأ: ${err.message}`,
        },
      };
    }
  }
}
