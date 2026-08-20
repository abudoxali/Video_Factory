import type { LlmProvider } from './types';
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  AIErrorCode,
} from '@video-factory/contracts';

export interface MockProviderOptions {
  shouldFail?: boolean;
  failErrorCode?: AIErrorCode;
  failErrorMessage?: string;
  mockData?: unknown;
  latencyMs?: number;
  simulatedTokens?: { input: number; output: number };
}

export class MockLlmProvider implements LlmProvider {
  public readonly name = 'mock-llm';
  public readonly defaultModel = 'mock-model-v1';
  private options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  public setOptions(options: MockProviderOptions) {
    this.options = options;
  }

  public async generateStructured<T = unknown>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    const latency = this.options.latencyMs || 50;

    if (this.options.shouldFail) {
      return {
        success: false,
        provider: this.name,
        model: this.defaultModel,
        promptVersion: request.promptVersion,
        latencyMs: latency,
        error: {
          code: this.options.failErrorCode || 'AI_PROVIDER_ERROR',
          message: this.options.failErrorMessage || 'Simulated provider failure in test mode',
        },
      };
    }

    const data = (this.options.mockData ?? {}) as T;

    if (request.validator) {
      const validation = request.validator(data);
      if (!validation.success) {
        return {
          success: false,
          provider: this.name,
          model: this.defaultModel,
          promptVersion: request.promptVersion,
          latencyMs: latency,
          error: {
            code: 'AI_VALIDATION_ERROR',
            message: validation.error || 'Mock data failed validation',
          },
        };
      }
      return {
        success: true,
        data: validation.data,
        provider: this.name,
        model: this.defaultModel,
        promptVersion: request.promptVersion,
        latencyMs: latency,
        inputTokens: this.options.simulatedTokens?.input || 120,
        outputTokens: this.options.simulatedTokens?.output || 450,
      };
    }

    return {
      success: true,
      data,
      provider: this.name,
      model: this.defaultModel,
      promptVersion: request.promptVersion,
      latencyMs: latency,
      inputTokens: this.options.simulatedTokens?.input || 120,
      outputTokens: this.options.simulatedTokens?.output || 450,
    };
  }
}
