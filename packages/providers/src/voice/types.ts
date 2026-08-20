import type { VoiceGenerationRequest, VoiceGenerationResult } from '@video-factory/contracts';

export interface VoiceProviderConfig {
  apiKey?: string;
  defaultModel?: string;
  defaultVoiceId?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface VoiceProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly defaultVoiceId: string;

  synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult>;
}
