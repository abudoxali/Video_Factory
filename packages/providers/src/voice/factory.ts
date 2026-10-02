import { assertMockProvidersAllowed } from '@video-factory/contracts';
import type { VoiceProvider, VoiceProviderConfig } from './types';
import { ElevenLabsVoiceProvider } from './elevenlabs';
import { MockVoiceProvider } from './mock';

export function createVoiceProvider(
  providerName?: string,
  config?: VoiceProviderConfig
): VoiceProvider {
  const name = providerName || process.env.VOICE_PROVIDER || 'elevenlabs';

  switch (name.toLowerCase()) {
    case 'elevenlabs':
    case 'eleven':
      return new ElevenLabsVoiceProvider(config);
    case 'mock':
    case 'test':
      assertMockProvidersAllowed('voice-factory');
      return new MockVoiceProvider();
    default:
      return new ElevenLabsVoiceProvider(config);
  }
}
