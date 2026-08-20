import type { LlmProvider, LlmProviderConfig } from './types';
import { GeminiProvider } from './gemini';
import { OpenAiProvider } from './openai';

export function getLlmProvider(config?: LlmProviderConfig & { providerType?: string }): LlmProvider {
  const providerType =
    config?.providerType ||
    process.env.LLM_PROVIDER ||
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini' : 'openai');

  if (providerType === 'openai') {
    return new OpenAiProvider(config);
  }

  return new GeminiProvider(config);
}
