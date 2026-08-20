import type { LlmProvider, LlmProviderConfig } from './types';
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  AIErrorCode,
} from '@video-factory/contracts';

export class OpenAiProvider implements LlmProvider {
  public readonly name = 'openai';
  public readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: LlmProviderConfig) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = config?.defaultModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
    this.timeoutMs = config?.timeoutMs || 30000;
  }

  public async generateStructured<T = unknown>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    const startTime = Date.now();
    const model = this.defaultModel;

    if (!this.apiKey) {
      return {
        success: false,
        provider: this.name,
        model,
        promptVersion: request.promptVersion,
        latencyMs: 0,
        error: {
          code: 'AI_AUTH_ERROR',
          message: 'مفتاح واجهة برمجة تطبيقات OpenAI غير متوفر (OPENAI_API_KEY is not configured)',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/chat/completions`;
      const timeout = request.timeoutMs || this.timeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const requestBody = {
        model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: false,
            schema: request.jsonSchema,
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorCode: AIErrorCode = 'AI_PROVIDER_ERROR';

        if (response.status === 401 || response.status === 403) {
          errorCode = 'AI_AUTH_ERROR';
        } else if (response.status === 429) {
          errorCode = 'AI_RATE_LIMIT';
        }

        return {
          success: false,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          error: {
            code: errorCode,
            message: `فشل طلب OpenAI HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            details: { status: response.status },
          },
        };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      const usage = data?.usage;

      if (!content) {
        return {
          success: false,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          inputTokens: usage?.prompt_tokens || null,
          outputTokens: usage?.completion_tokens || null,
          error: {
            code: 'AI_INVALID_OUTPUT',
            message: 'استجابة OpenAI فارغة',
          },
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          inputTokens: usage?.prompt_tokens || null,
          outputTokens: usage?.completion_tokens || null,
          error: {
            code: 'AI_INVALID_OUTPUT',
            message: 'فشل تحليل مخرجات JSON من OpenAI',
            details: String(parseError),
          },
        };
      }

      if (request.validator) {
        const validation = request.validator(parsed);
        if (!validation.success) {
          return {
            success: false,
            provider: this.name,
            model,
            promptVersion: request.promptVersion,
            latencyMs,
            inputTokens: usage?.prompt_tokens || null,
            outputTokens: usage?.completion_tokens || null,
            error: {
              code: 'AI_VALIDATION_ERROR',
              message: validation.error || 'فشلت مطابقة مخرجات الذكاء الاصطناعي مع عقد المخطط المطلوب',
            },
          };
        }
        return {
          success: true,
          data: validation.data,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          inputTokens: usage?.prompt_tokens || null,
          outputTokens: usage?.completion_tokens || null,
        };
      }

      return {
        success: true,
        data: parsed as T,
        provider: this.name,
        model,
        promptVersion: request.promptVersion,
        latencyMs,
        inputTokens: usage?.prompt_tokens || null,
        outputTokens: usage?.completion_tokens || null,
      };
    } catch (error: unknown) {
      const err = error as Error;
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';

      return {
        success: false,
        provider: this.name,
        model,
        promptVersion: request.promptVersion,
        latencyMs,
        error: {
          code: isTimeout ? 'AI_TIMEOUT' : 'AI_PROVIDER_ERROR',
          message: isTimeout
            ? 'انتهت مهلة الاتصال بمزود OpenAI'
            : `حدث خطأ أثناء الاتصال بمزود OpenAI: ${err.message}`,
        },
      };
    }
  }
}
