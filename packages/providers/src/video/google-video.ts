import type { VideoProvider, VideoProviderConfig } from './types';
import type {
  VideoGenerationRequest,
  VideoGenerationSubmission,
  VideoGenerationStatus,
  MediaErrorCode,
} from '@video-factory/contracts';

export class GoogleVideoProvider implements VideoProvider {
  public readonly name = 'google-video';
  public readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: VideoProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    // Centralized model selection: fast default gemini-omni-flash, cinematic option veo-3.1-generate-preview
    this.defaultModel = config?.defaultModel || process.env.VIDEO_MODEL || 'gemini-omni-flash';
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.timeoutMs = config?.timeoutMs || 120000;
  }

  public async generate(request: VideoGenerationRequest): Promise<VideoGenerationSubmission> {
    const model = request.model || this.defaultModel;

    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        model,
        requestId: `req_unauth_${Date.now()}`,
        status: 'FAILED',
        error: {
          code: 'MEDIA_AUTH_ERROR',
          message: 'مفتاح واجهة برمجة تطبيقات Google Video غير متوفر (GEMINI_API_KEY is not configured)',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/models/${model}:predictVideo?key=${this.apiKey}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const requestBody = {
        prompt: request.prompt,
        aspectRatio: request.aspectRatio || '9:16',
        durationSeconds: request.durationSeconds || 5,
        referenceImage: request.referenceImage || undefined,
        cameraDirection: request.cameraDirection || undefined,
        style: request.style || undefined,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

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
          requestId: `req_err_${Date.now()}`,
          status: 'FAILED',
          error: {
            code: errorCode,
            message: `فشل إرسال طلب الفيديو HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          },
        };
      }

      const data = await response.json();
      const requestId = data?.name || data?.requestId || `req_vid_${Date.now()}`;

      return {
        success: true,
        provider: this.name,
        model,
        requestId,
        status: 'PROCESSING',
        estimatedDurationSeconds: request.durationSeconds || 5,
      };
    } catch (error: unknown) {
      const err = error as Error;
      const isTimeout = err.name === 'AbortError';

      return {
        success: false,
        provider: this.name,
        model,
        requestId: `req_err_${Date.now()}`,
        status: 'FAILED',
        error: {
          code: isTimeout ? 'MEDIA_TIMEOUT' : 'MEDIA_PROVIDER_ERROR',
          message: isTimeout ? 'انتهت المهلة أثناء تقديم طلب الفيديو' : `خطأ: ${err.message}`,
        },
      };
    }
  }

  public async getStatus(requestId: string): Promise<VideoGenerationStatus> {
    if (!this.apiKey) {
      return {
        requestId,
        status: 'FAILED',
        error: {
          code: 'MEDIA_AUTH_ERROR',
          message: 'مفتاح API غير متوفر للاستعلام عن حالة الفيديو',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/${requestId}?key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          requestId,
          status: 'FAILED',
          error: {
            code: 'MEDIA_PROVIDER_ERROR',
            message: `فشل التحقق من حالة الفيديو HTTP ${response.status}`,
          },
        };
      }

      const data = await response.json();
      if (data?.done) {
        if (data?.error) {
          return {
            requestId,
            status: 'FAILED',
            error: {
              code: 'MEDIA_PROVIDER_ERROR',
              message: data.error.message || 'فشلت معالجة الفيديو لدى المزود',
            },
          };
        }

        const videoUri = data?.response?.videoUri || data?.response?.downloadUrl;
        return {
          requestId,
          status: 'COMPLETED',
          progress: 100,
          videoUrl: videoUri,
          mimeType: 'video/mp4',
        };
      }

      return {
        requestId,
        status: 'PROCESSING',
        progress: data?.metadata?.progressPercentage || 50,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        requestId,
        status: 'FAILED',
        error: {
          code: 'MEDIA_PROVIDER_ERROR',
          message: `خطأ أثناء الاستعلام عن حالة الفيديو: ${err.message}`,
        },
      };
    }
  }
}
