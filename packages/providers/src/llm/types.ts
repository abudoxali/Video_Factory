import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  AIErrorCode,
} from '@video-factory/contracts';

export interface LlmProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LlmProvider {
  readonly name: string;
  readonly defaultModel: string;
  generateStructured<T = unknown>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>>;
}

export { type StructuredGenerationRequest, type StructuredGenerationResult, type AIErrorCode };
