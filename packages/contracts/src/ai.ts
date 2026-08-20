import { z } from 'zod';

export const AIErrorCodeEnum = z.enum([
  'AI_AUTH_ERROR',
  'AI_RATE_LIMIT',
  'AI_TIMEOUT',
  'AI_INVALID_OUTPUT',
  'AI_PROVIDER_ERROR',
  'AI_VALIDATION_ERROR',
  'AI_RETRY_EXHAUSTED',
]);

export type AIErrorCode = z.infer<typeof AIErrorCodeEnum>;

export const ArabicAIErrorCodeMap: Record<AIErrorCode, string> = {
  AI_AUTH_ERROR: 'خطأ في التحقق من صلاحية مزود الذكاء الاصطناعي',
  AI_RATE_LIMIT: 'تم تجاوز الحد المسموح من الطلبات لمزود الذكاء الاصطناعي',
  AI_TIMEOUT: 'انتهت مهلة استجابة مزود الذكاء الاصطناعي',
  AI_INVALID_OUTPUT: 'المخرجات المولدة من النموذج غير مطابقة للمخطط المطلوب',
  AI_PROVIDER_ERROR: 'حدث خطأ في خدمة مزود الذكاء الاصطناعي',
  AI_VALIDATION_ERROR: 'فشل التحقق من صحة البيانات المولدة',
  AI_RETRY_EXHAUSTED: 'استنفدت محاولات المعالجة التلقائية دون التوصل لخطة صالحة',
};

export function getArabicAIErrorMessage(code: string): string {
  return ArabicAIErrorCodeMap[code as AIErrorCode] || 'حدث خطأ أثناء معالجة الذكاء الاصطناعي';
}

/**
 * Prompt Template Identifiers and Versions
 */
export const PROMPT_VERSIONS = {
  DIRECTOR_V1: 'director/v1',
  SCRIPT_V1: 'script/v1',
  CHAPTER_V1: 'chapter/v1',
  SCENE_PLANNER_V1: 'scene-planner/v1',
  SCENE_REPAIR_V1: 'scene-repair/v1',
  PUBLISHING_METADATA_V1: 'publishing-metadata/v1',
} as const;

export type PromptVersion = (typeof PROMPT_VERSIONS)[keyof typeof PROMPT_VERSIONS];

/**
 * Structured Generation Request Interface
 */
export interface StructuredGenerationRequest<T = unknown> {
  promptVersion: PromptVersion;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  validator?: (data: unknown) => { success: boolean; data?: T; error?: string };
}

/**
 * Structured Generation Result Interface
 */
export interface StructuredGenerationResult<T = unknown> {
  success: boolean;
  data?: T;
  provider: string;
  model: string;
  promptVersion: PromptVersion;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  error?: {
    code: AIErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * AI Run Audit Record Schema
 */
export const AIRunSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  jobId: z.string(),
  stage: z.string(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  status: z.enum(['SUCCESS', 'FAILED', 'RETRY']),
  attempt: z.number().int().default(1),
  latencyMs: z.number().int().nullable().optional(),
  inputTokens: z.number().int().nullable().optional(),
  outputTokens: z.number().int().nullable().optional(),
  inputMetadata: z.record(z.unknown()).nullable().optional(),
  outputMetadata: z.record(z.unknown()).nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  startedAt: z.date().or(z.string()),
  completedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()).optional(),
});

export type AIRun = z.infer<typeof AIRunSchema>;
