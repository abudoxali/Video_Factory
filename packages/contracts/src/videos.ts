import { z } from 'zod';

export const VideoTypeEnum = z.enum(['short', 'long']);
export type VideoType = z.infer<typeof VideoTypeEnum>;

export const VideoPlatformEnum = z.enum([
  'tiktok',
  'instagram_reels',
  'youtube_shorts',
  'youtube',
  'linkedin',
  'x',
]);
export type VideoPlatform = z.infer<typeof VideoPlatformEnum>;

export const VideoAspectRatioEnum = z.enum(['9:16', '16:9', '1:1']);
export type VideoAspectRatio = z.infer<typeof VideoAspectRatioEnum>;

export const VideoLanguageEnum = z.enum(['ar', 'en']);
export type VideoLanguage = z.infer<typeof VideoLanguageEnum>;

export const STANDARD_DURATIONS = [
  { value: 15, label: '15 ثانية', type: 'short' },
  { value: 30, label: '30 ثانية', type: 'short' },
  { value: 60, label: '60 ثانية (دقيقة)', type: 'short' },
  { value: 180, label: '3 دقائق', type: 'long' },
  { value: 300, label: '5 دقائق', type: 'long' },
  { value: 600, label: '10 دقائق', type: 'long' },
] as const;

export const ArabicVideoTypeMap: Record<VideoType, string> = {
  short: 'فيديو قصير',
  long: 'فيديو طويل',
};

export const ArabicPlatformMap: Record<VideoPlatform, string> = {
  tiktok: 'TikTok',
  instagram_reels: 'Instagram Reels',
  youtube_shorts: 'YouTube Shorts',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
};

export const ArabicAspectRatioMap: Record<VideoAspectRatio, string> = {
  '9:16': 'عمودي (9:16) - للموبايل والقصص',
  '16:9': 'أفقي (16:9) - للشاشات ويوتيوب',
  '1:1': 'مربع (1:1) - لمنشورات التواصل',
};

export const ArabicLanguageMap: Record<VideoLanguage, string> = {
  ar: 'العربية (الفصحى)',
  en: 'الإنجليزية (English)',
};

export const CreateVideoInputSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'عنوان الفيديو مطلوب' })
    .max(200, { message: 'العنوان طويل جداً (الحد الأقصى 200 حرف)' })
    .optional(),
  prompt: z
    .string()
    .min(5, { message: 'يرجى كتابة فكرة الفيديو بتفصيل أكثر (على الأقل 5 أحرف)' })
    .max(4000, { message: 'فكرة الفيديو طويلة جداً (الحد الأقصى 4000 حرف)' }),
  type: VideoTypeEnum,
  durationSeconds: z
    .number({ invalid_type_error: 'مدة الفيديو يجب أن تكون رقماً بالثواني' })
    .int('يجب أن تكون المدة بالثواني الصحيحة')
    .min(5, { message: 'أقل مدة للفيديو هي 5 ثوانٍ' })
    .max(3600, { message: 'أقصى مدة هي 3600 ثانية (60 دقيقة)' }),
  platform: VideoPlatformEnum,
  aspectRatio: VideoAspectRatioEnum,
  language: VideoLanguageEnum.default('ar'),
  projectId: z.string().optional(),
});

export type CreateVideoInput = z.infer<typeof CreateVideoInputSchema>;
