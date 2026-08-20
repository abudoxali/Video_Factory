import { z } from 'zod';

/**
 * Scene Media State Enum (Separate from Job and Plan status)
 */
export const SceneMediaStateEnum = z.enum([
  'PENDING',
  'QUEUED',
  'GENERATING',
  'READY',
  'FAILED',
  'AWAITING_STOCK',
  'TIMING_REVIEW_REQUIRED',
  'STALE',
]);

export type SceneMediaState = z.infer<typeof SceneMediaStateEnum>;

/**
 * Media Asset Type Enum
 */
export const MediaAssetTypeEnum = z.enum([
  'IMAGE',
  'VIDEO',
  'VOICE',
  'STOCK',
  'TEXT_RESOURCE',
]);

export type MediaAssetType = z.infer<typeof MediaAssetTypeEnum>;

/**
 * Media Asset Source Enum
 */
export const MediaAssetSourceEnum = z.enum([
  'GENERATED',
  'UPLOADED',
  'STOCK',
]);

export type MediaAssetSource = z.infer<typeof MediaAssetSourceEnum>;

/**
 * Media Asset Status Enum
 */
export const MediaAssetStatusEnum = z.enum([
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'FAILED',
]);

export type MediaAssetStatus = z.infer<typeof MediaAssetStatusEnum>;

/**
 * Media Error Code Enum
 */
export const MediaErrorCodeEnum = z.enum([
  'MEDIA_AUTH_ERROR',
  'MEDIA_RATE_LIMIT',
  'MEDIA_TIMEOUT',
  'MEDIA_PROVIDER_ERROR',
  'MEDIA_REJECTED',
  'MEDIA_DOWNLOAD_ERROR',
  'MEDIA_VALIDATION_ERROR',
  'STORAGE_UPLOAD_ERROR',
  'STORAGE_READ_ERROR',
  'VOICE_GENERATION_ERROR',
]);

export type MediaErrorCode = z.infer<typeof MediaErrorCodeEnum>;

/**
 * Arabic Mappings
 */
export const ArabicSceneMediaStateMap: Record<SceneMediaState, string> = {
  PENDING: 'قيد الانتظار',
  QUEUED: 'في طابور التوليد',
  GENERATING: 'جاري الإنشاء',
  READY: 'جاهز للاستخدام',
  FAILED: 'فشل الإنشاء',
  AWAITING_STOCK: 'بانتظار مادة مكتبية',
  TIMING_REVIEW_REQUIRED: 'يتطلب مراجعة التوقيت',
  STALE: 'بحاجة لتحديث',
};

export const ArabicMediaAssetTypeMap: Record<MediaAssetType, string> = {
  IMAGE: 'صورة',
  VIDEO: 'مقطع فيديو',
  VOICE: 'تعليق صوتي',
  STOCK: 'وسائط مخزنة',
  TEXT_RESOURCE: 'نصوص جرافيك',
};

export const ArabicMediaErrorMap: Record<MediaErrorCode, string> = {
  MEDIA_AUTH_ERROR: 'خطأ في مصادقة واجهة مزود الوسائط',
  MEDIA_RATE_LIMIT: 'تجاوز حد الاستخدام لمزود الوسائط',
  MEDIA_TIMEOUT: 'انتهت مهلة توليد الوسائط',
  MEDIA_PROVIDER_ERROR: 'حدث خطأ غير متوقع لدى مزود الوسائط',
  MEDIA_REJECTED: 'تم رفض المحتوى من قبل سياسات المزود',
  MEDIA_DOWNLOAD_ERROR: 'فشل تحميل الملف الناتج من المزود',
  MEDIA_VALIDATION_ERROR: 'الملف الناتج غير مطابق لمواصفات الوسائط',
  STORAGE_UPLOAD_ERROR: 'فشل رفع وتخزين الملف في R2',
  STORAGE_READ_ERROR: 'فشل قراءة الملف من التخزين',
  VOICE_GENERATION_ERROR: 'فشل توليد الصوت النطقي',
};

export function getArabicSceneMediaState(state: string): string {
  return ArabicSceneMediaStateMap[state as SceneMediaState] || state;
}

export function getArabicMediaAssetType(type: string): string {
  return ArabicMediaAssetTypeMap[type as MediaAssetType] || type;
}

export function getArabicMediaError(code: string): string {
  return ArabicMediaErrorMap[code as MediaErrorCode] || code;
}

/**
 * Image Generation Request & Result
 */
export const ImageGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  aspectRatio: z.string().default('9:16'),
  referenceImages: z.array(z.string()).optional(),
  styleContext: z.string().optional(),
  characterKey: z.string().optional(),
  sceneId: z.string().optional(),
  videoId: z.string().optional(),
  model: z.string().optional(),
});

export type ImageGenerationRequest = z.infer<typeof ImageGenerationRequestSchema>;

export interface ImageGenerationResult {
  success: boolean;
  provider: string;
  model: string;
  requestId?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  buffer?: Uint8Array | ArrayBuffer | any;
  providerAssetUrl?: string;
  usageMetadata?: Record<string, unknown>;
  latencyMs: number;
  error?: {
    code: MediaErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Video Generation Request & Result
 */
export const VideoGenerationRequestSchema = z.object({
  prompt: z.string().min(1),
  aspectRatio: z.string().default('9:16'),
  durationSeconds: z.number().int().min(1).max(60).default(5),
  referenceImage: z.string().optional(),
  startFrame: z.string().optional(),
  endFrame: z.string().optional(),
  sceneContext: z.string().optional(),
  style: z.string().optional(),
  cameraDirection: z.string().optional(),
  sceneId: z.string().optional(),
  videoId: z.string().optional(),
  model: z.string().optional(),
});

export type VideoGenerationRequest = z.infer<typeof VideoGenerationRequestSchema>;

export interface VideoGenerationSubmission {
  success: boolean;
  provider: string;
  model: string;
  requestId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  estimatedDurationSeconds?: number;
  error?: {
    code: MediaErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface VideoGenerationStatus {
  requestId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  videoUrl?: string;
  buffer?: Uint8Array | ArrayBuffer | any;
  mimeType?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  error?: {
    code: MediaErrorCode;
    message: string;
  };
}

/**
 * Voice Generation Request & Result
 */
export const VoiceGenerationRequestSchema = z.object({
  text: z.string().min(1),
  language: z.enum(['ar', 'en']).default('ar'),
  voiceId: z.string().optional(),
  model: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  style: z.string().optional(),
  outputFormat: z.string().default('mp3_44100_128'),
  sceneId: z.string().optional(),
  videoId: z.string().optional(),
  targetDurationSeconds: z.number().optional(),
});

export type VoiceGenerationRequest = z.infer<typeof VoiceGenerationRequestSchema>;

export interface VoiceGenerationResult {
  success: boolean;
  provider: string;
  model: string;
  voiceId?: string;
  buffer?: Uint8Array | ArrayBuffer | any;
  mimeType: string;
  actualDurationSeconds: number;
  estimatedDurationSeconds?: number;
  isTimingMismatch?: boolean;
  latencyMs: number;
  error?: {
    code: MediaErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Storage Schemas
 */
export interface StoragePutOptions {
  bucket?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StoragePutResult {
  bucket: string;
  objectKey: string;
  sizeBytes: number;
  checksum: string;
  contentType: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresInSeconds: number;
  objectKey: string;
}

/**
 * Canonical Media Asset Schema
 */
export const MediaAssetSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  sceneId: z.string().nullable().optional(),
  chapterId: z.string().nullable().optional(),
  type: MediaAssetTypeEnum,
  source: MediaAssetSourceEnum.default('GENERATED'),
  provider: z.string(),
  model: z.string(),
  providerRequestId: z.string().nullable().optional(),
  storageProvider: z.string().default('r2'),
  bucket: z.string(),
  objectKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().positive().nullable().optional(),
  status: MediaAssetStatusEnum.default('ACTIVE'),
  checksum: z.string().nullable().optional(),
  generationRunId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;

/**
 * Media Generation Run Schema
 */
export const MediaRunSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  sceneId: z.string().nullable().optional(),
  type: MediaAssetTypeEnum,
  provider: z.string(),
  model: z.string(),
  providerRequestId: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  attempt: z.number().int().default(1),
  startedAt: z.date().or(z.string()),
  completedAt: z.date().or(z.string()).nullable().optional(),
  latencyMs: z.number().int().nullable().optional(),
  inputMetadata: z.record(z.unknown()).nullable().optional(),
  outputMetadata: z.record(z.unknown()).nullable().optional(),
  errorCode: MediaErrorCodeEnum.nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  usageMetadata: z.record(z.unknown()).nullable().optional(),
  costMetadata: z.record(z.unknown()).nullable().optional(),
});

export type MediaRun = z.infer<typeof MediaRunSchema>;

/**
 * Internal Media Callback Payload Schema
 */
export const MediaCallbackPayloadSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  job_id: z.string().min(1),
  video_id: z.string().min(1),
  scene_id: z.string().optional(),
  event_id: z.string().min(1),
  stage: z.string(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  media_type: MediaAssetTypeEnum.optional(),
  scene_media_state: SceneMediaStateEnum.optional(),
  asset: MediaAssetSchema.omit({ id: true, createdAt: true, updatedAt: true }).optional(),
});

export type MediaCallbackPayload = z.infer<typeof MediaCallbackPayloadSchema>;

/**
 * Deterministic Object Key Helper
 */
export function buildR2ObjectKey(params: {
  userId?: string;
  projectId?: string;
  videoId: string;
  sceneId?: string;
  assetType: MediaAssetType;
  assetId: string;
  extension: string;
}): string {
  const user = params.userId || 'default';
  const project = params.projectId || 'default';
  const ext = params.extension.startsWith('.') ? params.extension.slice(1) : params.extension;
  const typeFolder = params.assetType.toLowerCase();

  if (params.sceneId) {
    return `video-factory/users/${user}/projects/${project}/videos/${params.videoId}/scenes/${params.sceneId}/${typeFolder}/${params.assetId}.${ext}`;
  }
  return `video-factory/users/${user}/projects/${project}/videos/${params.videoId}/${typeFolder}/${params.assetId}.${ext}`;
}
