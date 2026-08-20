import { z } from 'zod';
import { SocialPlatformEnum, type SocialPlatform } from './social';

export const PublicationStatusEnum = z.enum([
  'DRAFT',
  'QUEUED',
  'VALIDATING',
  'UPLOADING',
  'PROCESSING',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
  'CANCELLED',
  'REQUIRES_REAUTH',
]);
export type PublicationStatus = z.infer<typeof PublicationStatusEnum>;

export const PublicationErrorCodeEnum = z.enum([
  'PUBLISH_AUTH_REQUIRED',
  'PUBLISH_TOKEN_EXPIRED',
  'PUBLISH_PERMISSION_DENIED',
  'PUBLISH_INVALID_MEDIA',
  'PUBLISH_RATE_LIMIT',
  'PUBLISH_UPLOAD_FAILED',
  'PUBLISH_PROCESSING_FAILED',
  'PUBLISH_REJECTED',
  'PUBLISH_TIMEOUT',
  'PUBLISH_PROVIDER_ERROR',
  'PUBLISH_DUPLICATE',
]);
export type PublicationErrorCode = z.infer<typeof PublicationErrorCodeEnum>;

export const YouTubePrivacyEnum = z.enum(['private', 'unlisted', 'public']);
export type YouTubePrivacy = z.infer<typeof YouTubePrivacyEnum>;

export const TikTokPrivacyEnum = z.enum([
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
]);
export type TikTokPrivacy = z.infer<typeof TikTokPrivacyEnum>;

export const YouTubeMetadataSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(5000).default(''),
  tags: z.array(z.string()).default([]),
  categoryId: z.string().default('22'), // 22 = People & Blogs
  privacy: YouTubePrivacyEnum.default('private'),
  madeForKids: z.boolean().default(false),
  publishAt: z.coerce.date().optional(),
});
export type YouTubeMetadata = z.infer<typeof YouTubeMetadataSchema>;

export const InstagramMetadataSchema = z.object({
  caption: z.string().max(2200).default(''),
  hashtags: z.array(z.string()).default([]),
  shareToFeed: z.boolean().default(true),
  locationId: z.string().optional(),
});
export type InstagramMetadata = z.infer<typeof InstagramMetadataSchema>;

export const TikTokMetadataSchema = z.object({
  caption: z.string().max(2200).default(''),
  privacy: TikTokPrivacyEnum.default('SELF_ONLY'),
  allowComments: z.boolean().default(true),
  allowDuet: z.boolean().default(true),
  allowStitch: z.boolean().default(true),
  brandContentToggle: z.boolean().default(false),
  brandOrganicToggle: z.boolean().default(false),
});
export type TikTokMetadata = z.infer<typeof TikTokMetadataSchema>;

export const PublicationMetadataSchema = z.object({
  title: z.string().min(1).max(100),
  caption: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  privacy: z.string().default('private'),
  youtube: YouTubeMetadataSchema.optional(),
  instagram: InstagramMetadataSchema.optional(),
  tiktok: TikTokMetadataSchema.optional(),
});
export type PublicationMetadata = z.infer<typeof PublicationMetadataSchema>;

export const PublicationSchema = z.object({
  id: z.string(),
  videoId: z.string(),
  renderId: z.string(),
  socialAccountId: z.string(),
  userId: z.string(),
  platform: SocialPlatformEnum,
  status: PublicationStatusEnum.default('DRAFT'),
  metadataJson: PublicationMetadataSchema,
  platformPublicationId: z.string().optional().nullable(),
  platformUrl: z.string().url().optional().nullable(),
  idempotencyKey: z.string().min(8),
  scheduledAt: z.coerce.date().optional().nullable(),
  startedAt: z.coerce.date().optional().nullable(),
  publishedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});
export type Publication = z.infer<typeof PublicationSchema>;

export const PublicationAttemptSchema = z.object({
  id: z.string(),
  publicationId: z.string(),
  attempt: z.number().int().positive().default(1),
  provider: z.string(),
  status: z.string(),
  startedAt: z.coerce.date().default(() => new Date()),
  completedAt: z.coerce.date().optional().nullable(),
  latencyMs: z.number().int().optional().nullable(),
  providerRequestId: z.string().optional().nullable(),
  errorCode: PublicationErrorCodeEnum.optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  createdAt: z.coerce.date().default(() => new Date()),
});
export type PublicationAttempt = z.infer<typeof PublicationAttemptSchema>;

export interface PlatformCapabilities {
  platform: SocialPlatform;
  supportedAspectRatios: Array<'9:16' | '16:9' | '1:1'>;
  maxDurationSeconds: number;
  minDurationSeconds: number;
  maxFileSizeBytes: number;
  supportedVideoCodecs: string[];
  supportedAudioCodecs: string[];
  supportedContainers: string[];
  supportsScheduling: boolean;
  supportsPublicPublishing: boolean;
  supportsAnalytics: boolean;
  requiresBusinessAccount?: boolean;
}

export const PLATFORM_CAPABILITIES: Record<SocialPlatform, PlatformCapabilities> = {
  YOUTUBE: {
    platform: 'YOUTUBE',
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    maxDurationSeconds: 43200, // 12 hours
    minDurationSeconds: 1,
    maxFileSizeBytes: 128 * 1024 * 1024 * 1024, // 128GB
    supportedVideoCodecs: ['h264', 'hevc', 'vp9', 'av1'],
    supportedAudioCodecs: ['aac', 'mp3', 'opus'],
    supportedContainers: ['mp4', 'mov', 'webm'],
    supportsScheduling: true,
    supportsPublicPublishing: true,
    supportsAnalytics: true,
  },
  INSTAGRAM: {
    platform: 'INSTAGRAM',
    supportedAspectRatios: ['9:16', '1:1', '16:9'],
    maxDurationSeconds: 900, // 15 mins for Reels
    minDurationSeconds: 3,
    maxFileSizeBytes: 1024 * 1024 * 1024, // 1GB
    supportedVideoCodecs: ['h264', 'hevc'],
    supportedAudioCodecs: ['aac'],
    supportedContainers: ['mp4', 'mov'],
    supportsScheduling: false,
    supportsPublicPublishing: true,
    supportsAnalytics: true,
    requiresBusinessAccount: true,
  },
  TIKTOK: {
    platform: 'TIKTOK',
    supportedAspectRatios: ['9:16', '1:1'],
    maxDurationSeconds: 600, // 10 mins
    minDurationSeconds: 3,
    maxFileSizeBytes: 4 * 1024 * 1024 * 1024, // 4GB
    supportedVideoCodecs: ['h264', 'hevc'],
    supportedAudioCodecs: ['aac'],
    supportedContainers: ['mp4', 'mov', 'webm'],
    supportsScheduling: false,
    supportsPublicPublishing: true,
    supportsAnalytics: true,
  },
};

export const ArabicPublicationStatusMap: Record<PublicationStatus, string> = {
  DRAFT: 'مسودة',
  QUEUED: 'في قائمة النشر',
  VALIDATING: 'مراجعة متطلبات المنصة',
  UPLOADING: 'جاري رفع الفيديو',
  PROCESSING: 'جاري معالجة الفيديو في المنصة',
  PUBLISHING: 'جاري النشر وتأكيد الرابط',
  PUBLISHED: 'تم النشر بنجاح',
  FAILED: 'فشل النشر',
  CANCELLED: 'تم إلغاء النشر',
  REQUIRES_REAUTH: 'يلزم إعادة ربط الحساب',
};

export const ArabicPublicationErrorMap: Record<PublicationErrorCode, string> = {
  PUBLISH_AUTH_REQUIRED: 'يتطلب ربط الحساب أولاً',
  PUBLISH_TOKEN_EXPIRED: 'انتهت صلاحية جلسة الاتصال بالمنصة',
  PUBLISH_PERMISSION_DENIED: 'الحساب لا يملك الصلاحيات الكافية للنشر',
  PUBLISH_INVALID_MEDIA: 'ملف الفيديو غير متوافق مع قيود المنصة (الأبعاد أو المدة أو الحجم)',
  PUBLISH_RATE_LIMIT: 'تم تجاوز الحد المسموح للنشر في المنصة، يرجى المحاولة لاحقاً',
  PUBLISH_UPLOAD_FAILED: 'فشل رفع الفيديو إلى خوادم المنصة',
  PUBLISH_PROCESSING_FAILED: 'فشلت المنصة في معالجة وترميز الفيديو',
  PUBLISH_REJECTED: 'رفضت المنصة المحتوى لمخالفة السياسات أو المتطلبات',
  PUBLISH_TIMEOUT: 'انتهت المهلة الزمنية لمعالجة النشر لدى المنصة',
  PUBLISH_PROVIDER_ERROR: 'حدث خطأ غير متوقع في خوادم منصة التواصل',
  PUBLISH_DUPLICATE: 'تم إرسال هذا المنشور مسبقاً لمنع التكرار غير المقصود',
};

export function getArabicPublicationStatus(status: string): string {
  const norm = status.toUpperCase() as PublicationStatus;
  return ArabicPublicationStatusMap[norm] || status;
}

export function getArabicPublicationError(code: string): string {
  const norm = code.toUpperCase() as PublicationErrorCode;
  return ArabicPublicationErrorMap[norm] || code;
}
