import type { VoiceProvider, VoiceProviderConfig } from './types';
import type { VoiceGenerationRequest, VoiceGenerationResult, MediaErrorCode } from '@video-factory/contracts';

export class ElevenLabsVoiceProvider implements VoiceProvider {
  public readonly name = 'elevenlabs';
  public readonly defaultModel: string;
  public readonly defaultVoiceId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: VoiceProviderConfig) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || '';
    this.defaultModel = config?.defaultModel || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    // Standard Arabic-capable production voice default (e.g. Rachel / Adam or configured permitted ID)
    this.defaultVoiceId = config?.defaultVoiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    this.baseUrl = config?.baseUrl || 'https://api.elevenlabs.io/v1';
    this.timeoutMs = config?.timeoutMs || 60000;
  }

  public async synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    const voiceId = request.voiceId || this.defaultVoiceId;

    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        model,
        voiceId,
        mimeType: 'audio/mpeg',
        actualDurationSeconds: 0,
        latencyMs: 0,
        error: {
          code: 'MEDIA_AUTH_ERROR',
          message: 'مفتاح واجهة برمجة تطبيقات ElevenLabs غير متوفر (ELEVENLABS_API_KEY is not configured)',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/text-to-speech/${voiceId}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const requestBody = {
        text: request.text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: request.speed || 1.0,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorCode: MediaErrorCode = 'VOICE_GENERATION_ERROR';

        if (response.status === 401 || response.status === 403) {
          errorCode = 'MEDIA_AUTH_ERROR';
        } else if (response.status === 429) {
          errorCode = 'MEDIA_RATE_LIMIT';
        }

        return {
          success: false,
          provider: this.name,
          model,
          voiceId,
          mimeType: 'audio/mpeg',
          actualDurationSeconds: 0,
          latencyMs,
          error: {
            code: errorCode,
            message: `فشل توليد الصوت من ElevenLabs HTTP ${response.status}: ${errorText.substring(0, 200)}`,
          },
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Estimate actual duration from 128kbps MP3 bitrate (16000 bytes per second)
      // or accurate frame header approximation:
      const bytesPerSecond = 16000;
      const actualDurationSeconds = Math.max(1, Math.round((buffer.length / bytesPerSecond) * 10) / 10);

      // Timing mismatch check (>25% difference from target duration if target was specified)
      let isTimingMismatch = false;
      if (request.targetDurationSeconds && request.targetDurationSeconds > 0) {
        const diff = Math.abs(actualDurationSeconds - request.targetDurationSeconds);
        if (diff > Math.max(2, request.targetDurationSeconds * 0.25)) {
          isTimingMismatch = true;
        }
      }

      return {
        success: true,
        provider: this.name,
        model,
        voiceId,
        buffer,
        mimeType: 'audio/mpeg',
        actualDurationSeconds,
        estimatedDurationSeconds: request.targetDurationSeconds,
        isTimingMismatch,
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
        voiceId,
        mimeType: 'audio/mpeg',
        actualDurationSeconds: 0,
        latencyMs,
        error: {
          code: isTimeout ? 'MEDIA_TIMEOUT' : 'VOICE_GENERATION_ERROR',
          message: isTimeout ? 'انتهت مهلة توليد الصوت النطقي' : `خطأ: ${err.message}`,
        },
      };
    }
  }
}
