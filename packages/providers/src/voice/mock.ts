import type { VoiceProvider } from './types';
import type { VoiceGenerationRequest, VoiceGenerationResult } from '@video-factory/contracts';

// Minimal MP3 header buffer for testing
const MOCK_MP3_BUFFER = Buffer.from(
  '//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAAACgAICAkKDA4QEBIUFRYXGBkaHB4gIiMmJigoKistLi8wMjI0NTY3OTs8PT4/QEFCQ0RFRkdISUpLTE1OT1BSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/',
  'base64'
);

export class MockVoiceProvider implements VoiceProvider {
  public readonly name = 'mock-voice';
  public readonly defaultModel: string = 'mock-multilingual-v2';
  public readonly defaultVoiceId: string = 'mock-voice-id';
  public shouldFail = false;

  public async synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        model: this.defaultModel,
        voiceId: this.defaultVoiceId,
        mimeType: 'audio/mpeg',
        actualDurationSeconds: 0,
        latencyMs: 10,
        error: {
          code: 'VOICE_GENERATION_ERROR',
          message: 'فشل محاكي توليد الصوت للاختبار',
        },
      };
    }

    const estimatedWords = request.text.trim().split(/\s+/).length;
    const computedDuration = Math.max(1, Math.round((estimatedWords / 2.4) * 10) / 10);
    const actualDurationSeconds = request.targetDurationSeconds || computedDuration;

    return {
      success: true,
      provider: this.name,
      model: this.defaultModel,
      voiceId: request.voiceId || this.defaultVoiceId,
      buffer: MOCK_MP3_BUFFER,
      mimeType: 'audio/mpeg',
      actualDurationSeconds,
      estimatedDurationSeconds: request.targetDurationSeconds,
      isTimingMismatch: false,
      latencyMs: 20,
    };
  }
}
