import type { LlmProvider, LlmProviderConfig } from './types';
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  AIErrorCode,
} from '@video-factory/contracts';

export class GeminiProvider implements LlmProvider {
  public readonly name = 'gemini';
  public readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: LlmProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.defaultModel = config?.defaultModel || process.env.AI_MODEL_DIRECTOR || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
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
          message: 'مفتاح واجهة برمجة تطبيقات Gemini غير متوفر (GEMINI_API_KEY is not configured)',
        },
      };
    }

    try {
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      const timeout = request.timeoutMs || this.timeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
          responseMimeType: 'application/json',
          responseSchema: request.jsonSchema,
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
            message: `فشل طلب Gemini HTTP ${response.status}: ${errorText.substring(0, 200)}`,
            details: { status: response.status },
          },
        };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage = data?.usageMetadata;

      if (!text) {
        return {
          success: false,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          inputTokens: usage?.promptTokenCount || null,
          outputTokens: usage?.candidatesTokenCount || null,
          error: {
            code: 'AI_INVALID_OUTPUT',
            message: 'استجابة Gemini فارغة أو لم ترجع أي نص صالح',
          },
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        return {
          success: false,
          provider: this.name,
          model,
          promptVersion: request.promptVersion,
          latencyMs,
          inputTokens: usage?.promptTokenCount || null,
          outputTokens: usage?.candidatesTokenCount || null,
          error: {
            code: 'AI_INVALID_OUTPUT',
            message: 'فشل تحليل مخرجات JSON من النموذج',
            details: String(parseError),
          },
        };
      }

      // Run validator if provided
      if (request.validator) {
        const validation = request.validator(parsed);
        if (!validation.success) {
          return {
            success: false,
            provider: this.name,
            model,
            promptVersion: request.promptVersion,
            latencyMs,
            inputTokens: usage?.promptTokenCount || null,
            outputTokens: usage?.candidatesTokenCount || null,
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
          inputTokens: usage?.promptTokenCount || null,
          outputTokens: usage?.candidatesTokenCount || null,
        };
      }

      return {
        success: true,
        data: parsed as T,
        provider: this.name,
        model,
        promptVersion: request.promptVersion,
        latencyMs,
        inputTokens: usage?.promptTokenCount || null,
        outputTokens: usage?.candidatesTokenCount || null,
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
            ? 'انتهت مهلة الاتصال بمزود الذكاء الاصطناعي'
            : `حدث خطأ أثناء الاتصال بمزود Gemini: ${err.message}`,
        },
      };
    }
  }
}
