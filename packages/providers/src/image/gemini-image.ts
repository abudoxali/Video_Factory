import type { ImageProvider, ImageProviderConfig } from './types';
import type { ImageGenerationRequest, ImageGenerationResult, MediaErrorCode } from '@video-factory/contracts';

export class GeminiImageProvider implements ImageProvider {
  public readonly name = 'gemini-image';
  public readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: ImageProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.defaultModel = config?.defaultModel || process.env.IMAGE_MODEL || 'gemini-3.1-flash-image';
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
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
          message: 'مفتاح واجهة برمجة تطبيقات Gemini للصور غير متوفر (GEMINI_API_KEY is not configured)',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/models/${model}:predict?key=${this.apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      // Map aspect ratio to dimensions
      let sampleCount = 1;
      let aspectRatio = request.aspectRatio || '9:16';
      if (aspectRatio === '9:16' || aspectRatio === 'vertical') {
        aspectRatio = '9:16';
      } else if (aspectRatio === '16:9' || aspectRatio === 'horizontal') {
        aspectRatio = '16:9';
      } else {
        aspectRatio = '1:1';
      }

      const promptText = request.styleContext
        ? `${request.prompt}. Style direction: ${request.styleContext}`
        : request.prompt;

      const requestBody = {
        instances: [{ prompt: promptText }],
        parameters: {
          sampleCount,
          aspectRatio,
          outputOptions: { mimeType: 'image/png' },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
        } else if (response.status === 400 && errorText.includes('SAFETY')) {
          errorCode = 'MEDIA_REJECTED';
        }

        return {
          success: false,
          provider: this.name,
          model,
          latencyMs,
          error: {
            code: errorCode,
            message: `فشل طلب توليد الصورة عبر Gemini HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            details: { status: response.status },
          },
        };
      }

      const data = await response.json();
      const base64Bytes =
        data?.predictions?.[0]?.bytesBase64Encoded ||
        data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Bytes) {
        return {
          success: false,
          provider: this.name,
          model,
          latencyMs,
          error: {
            code: 'MEDIA_VALIDATION_ERROR',
            message: 'لم يتم إرجاع أي بايتات صورة صالحة من المزود',
          },
        };
      }

      const buffer = Buffer.from(base64Bytes, 'base64');
      const isPortrait = aspectRatio === '9:16';
      const width = isPortrait ? 768 : 1344;
      const height = isPortrait ? 1344 : 768;

      return {
        success: true,
        provider: this.name,
        model,
        mimeType: 'image/png',
        buffer,
        width,
        height,
        latencyMs,
        usageMetadata: { sampleCount: 1 },
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
          message: isTimeout
            ? 'انتهت مهلة توليد الصورة'
            : `حدث خطأ أثناء توليد الصورة عبر Gemini: ${err.message}`,
        },
      };
    }
  }
}
