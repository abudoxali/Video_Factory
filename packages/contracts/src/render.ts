import { z } from 'zod';
import { MediaStrategyEnum } from './planning';

/**
 * Standard Output Presets
 */
export const OutputPresetSchema = z.enum(['9:16', '16:9', '1:1']);
export type OutputPreset = z.infer<typeof OutputPresetSchema>;

export interface ResolutionConfig {
  width: number;
  height: number;
  label: string;
  aspectRatio: string;
}

export const OUTPUT_PRESET_CONFIGS: Record<OutputPreset, ResolutionConfig> = {
  '9:16': { width: 1080, height: 1920, label: 'عمودي (Reels / TikTok / Shorts)', aspectRatio: '9:16' },
  '16:9': { width: 1920, height: 1080, label: 'أفقي (YouTube / LinkedIn)', aspectRatio: '16:9' },
  '1:1': { width: 1080, height: 1080, label: 'مربع (Square Feed)', aspectRatio: '1:1' },
};

export const DEFAULT_FPS = 30;

/**
 * Frame Math Helpers
 */
export function secondsToFrames(seconds: number, fps: number = DEFAULT_FPS): number {
  return Math.max(1, Math.round(seconds * fps));
}

export function framesToSeconds(frames: number, fps: number = DEFAULT_FPS): number {
  return Math.round((frames / fps) * 1000) / 1000;
}

/**
 * Transitions
 */
export const TransitionTypeEnum = z.enum(['CUT', 'FADE', 'DISSOLVE', 'SLIDE', 'ZOOM', 'NONE']);
export type TransitionType = z.infer<typeof TransitionTypeEnum>;

export function normalizeTransition(transitionStr?: string): TransitionType {
  if (!transitionStr) return 'FADE';
  const clean = transitionStr.trim().toUpperCase();
  if (['CUT', 'FADE', 'DISSOLVE', 'SLIDE', 'ZOOM', 'NONE'].includes(clean)) {
    return clean as TransitionType;
  }
  return 'FADE';
}

/**
 * Image Animation Presets
 */
export const ImageAnimationEnum = z.enum([
  'STATIC',
  'KEN_BURNS',
  'ZOOM_IN',
  'ZOOM_OUT',
  'PAN_LEFT',
  'PAN_RIGHT',
  'PARALLAX_SIMPLE',
]);
export type ImageAnimation = z.infer<typeof ImageAnimationEnum>;

/**
 * Caption Styles & Segments
 */
export const CaptionStyleEnum = z.enum(['CLEAN', 'BOLD', 'SOCIAL', 'MINIMAL']);
export type CaptionStyle = z.infer<typeof CaptionStyleEnum>;

export const RenderCaptionSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  sceneId: z.string(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  durationFrames: z.number().int().positive(),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  isRtl: z.boolean().default(true),
});

export type RenderCaptionSegment = z.infer<typeof RenderCaptionSegmentSchema>;

/**
 * Builds deterministic caption segments with phrase-level chunking for Arabic narration
 */
export function buildCaptionSegments(
  narration: string,
  sceneStartFrame: number,
  sceneDurationFrames: number,
  fps: number = DEFAULT_FPS,
  sceneId: string = 'scene'
): RenderCaptionSegment[] {
  if (!narration || narration.trim().length === 0) {
    return [];
  }

  // Split into manageable phrases (approx 4-7 words per subtitle line)
  const words = narration.trim().split(/\s+/);
  if (words.length === 0) return [];

  const CHUNK_SIZE = 5;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
  }

  const framesPerChunk = Math.max(1, Math.floor(sceneDurationFrames / chunks.length));

  return chunks.map((chunkText, idx) => {
    const isLast = idx === chunks.length - 1;
    const startFrame = sceneStartFrame + idx * framesPerChunk;
    const endFrame = isLast ? sceneStartFrame + sceneDurationFrames : startFrame + framesPerChunk;
    const durationFrames = endFrame - startFrame;

    return {
      id: `cap_${sceneId}_${idx + 1}`,
      text: chunkText,
      sceneId,
      startFrame,
      endFrame,
      durationFrames,
      startTime: framesToSeconds(startFrame, fps),
      endTime: framesToSeconds(endFrame, fps),
      isRtl: true,
    };
  });
}

/**
 * Render Scene Contract
 */
export const RenderSceneSchema = z.object({
  sceneId: z.string(),
  position: z.number().int().positive(),
  purpose: z.string().optional(),
  chapterId: z.string().nullable().optional(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  mediaStrategy: MediaStrategyEnum,
  visualAsset: z
    .object({
      assetId: z.string().optional(),
      url: z.string().optional(),
      type: z.enum(['IMAGE', 'VIDEO', 'STOCK']).default('IMAGE'),
      fit: z.enum(['cover', 'contain', 'crop']).default('cover'),
      animation: ImageAnimationEnum.default('KEN_BURNS'),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  narrationAsset: z
    .object({
      assetId: z.string().optional(),
      url: z.string().optional(),
      durationSeconds: z.number().optional(),
      startFrame: z.number().int().nonnegative().optional(),
      durationFrames: z.number().int().positive().optional(),
      volume: z.number().min(0).max(1).default(1),
    })
    .optional(),
  onScreenText: z.string().optional(),
  visualDescription: z.string(),
  visualPrompt: z.string().optional(),
  transition: z
    .object({
      type: TransitionTypeEnum.default('FADE'),
      durationFrames: z.number().int().default(15), // 0.5s at 30fps
    })
    .default({ type: 'FADE', durationFrames: 15 }),
  layout: z
    .object({
      template: z.string().default('default'),
      theme: z.string().default('dark'),
      backgroundColor: z.string().default('#0b0f19'),
    })
    .default({ template: 'default', theme: 'dark', backgroundColor: '#0b0f19' }),
  captions: z.array(RenderCaptionSegmentSchema).default([]),
});

export type RenderScene = z.infer<typeof RenderSceneSchema>;

/**
 * Audio Composition Contract
 */
export const RenderAudioTrackSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(['NARRATION', 'MUSIC', 'SFX']),
  sceneId: z.string().optional(),
  startFrame: z.number().int().nonnegative().default(0),
  durationFrames: z.number().int().positive(),
  volume: z.number().min(0).max(1).default(1),
  fadeInFrames: z.number().int().nonnegative().default(0),
  fadeOutFrames: z.number().int().nonnegative().default(0),
  loop: z.boolean().default(false),
});

export type RenderAudioTrack = z.infer<typeof RenderAudioTrackSchema>;

/**
 * Branding Configuration
 */
export const RenderBrandingSchema = z.object({
  logoUrl: z.string().optional(),
  watermark: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().optional(),
      logoUrl: z.string().optional(),
      opacity: z.number().min(0).max(1).default(0.5),
      position: z.enum(['TOP_RIGHT', 'TOP_LEFT', 'BOTTOM_RIGHT', 'BOTTOM_LEFT']).default('TOP_RIGHT'),
    })
    .default({ enabled: false, opacity: 0.5, position: 'TOP_RIGHT' }),
  introCard: z
    .object({
      enabled: z.boolean().default(false),
      title: z.string().optional(),
      durationFrames: z.number().int().default(60),
    })
    .default({ enabled: false, durationFrames: 60 }),
  outroCard: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().optional(),
      durationFrames: z.number().int().default(90),
    })
    .default({ enabled: false, durationFrames: 90 }),
});

export type RenderBranding = z.infer<typeof RenderBrandingSchema>;

/**
 * Canonical Render Manifest Contract
 */
export const RenderManifestSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  renderId: z.string(),
  videoId: z.string(),
  title: z.string().default('فيديو جديد'),
  language: z.enum(['ar', 'en']).default('ar'),
  composition: z.object({
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1920),
    fps: z.number().int().positive().default(30),
    durationInFrames: z.number().int().positive(),
    durationSeconds: z.number().positive(),
    aspectRatio: OutputPresetSchema.default('9:16'),
  }),
  scenes: z.array(RenderSceneSchema).min(1),
  audio: z
    .object({
      narrationTracks: z.array(RenderAudioTrackSchema).default([]),
      musicTracks: z.array(RenderAudioTrackSchema).default([]),
      sfxTracks: z.array(RenderAudioTrackSchema).default([]),
      ducking: z
        .object({
          enabled: z.boolean().default(true),
          duckedVolume: z.number().min(0).max(1).default(0.15),
          normalVolume: z.number().min(0).max(1).default(0.6),
          fadeFrames: z.number().int().default(15),
        })
        .default({ enabled: true, duckedVolume: 0.15, normalVolume: 0.6, fadeFrames: 15 }),
    })
    .default({
      narrationTracks: [],
      musicTracks: [],
      sfxTracks: [],
      ducking: { enabled: true, duckedVolume: 0.15, normalVolume: 0.6, fadeFrames: 15 },
    }),
  captions: z
    .object({
      enabled: z.boolean().default(true),
      style: CaptionStyleEnum.default('SOCIAL'),
      safeAreaMarginPercent: z.number().min(0).max(40).default(18), // Safe bottom margin for TikTok/Reels UI
      primaryColor: z.string().default('#ffffff'),
      highlightColor: z.string().default('#38bdf8'),
      backgroundColor: z.string().default('rgba(0, 0, 0, 0.65)'),
      fontSize: z.number().int().default(48),
      maxLines: z.number().int().default(2),
      rtl: z.boolean().default(true),
      fontFamily: z.string().default('Cairo, sans-serif'),
    })
    .default({
      enabled: true,
      style: 'SOCIAL',
      safeAreaMarginPercent: 18,
      primaryColor: '#ffffff',
      highlightColor: '#38bdf8',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      fontSize: 48,
      maxLines: 2,
      rtl: true,
      fontFamily: 'Cairo, sans-serif',
    }),
  branding: RenderBrandingSchema.default({
    watermark: { enabled: false, opacity: 0.5, position: 'TOP_RIGHT' },
    introCard: { enabled: false, durationFrames: 60 },
    outroCard: { enabled: false, durationFrames: 90 },
  }),
  output: z
    .object({
      format: z.literal('mp4').default('mp4'),
      codec: z.literal('h264').default('h264'),
      audioCodec: z.literal('aac').default('aac'),
      crf: z.number().int().default(20),
    })
    .default({ format: 'mp4', codec: 'h264', audioCodec: 'aac', crf: 20 }),
});

export type RenderManifest = z.infer<typeof RenderManifestSchema>;

/**
 * Render Status Enum & Arabic Mappings
 */
export const RenderStatusEnum = z.enum([
  'PENDING',
  'QUEUED',
  'PREPARING',
  'RENDERING',
  'UPLOADING',
  'VALIDATING',
  'READY',
  'FAILED',
  'CANCELLED',
  'SUPERSEDED',
]);

export type RenderStatus = z.infer<typeof RenderStatusEnum>;

export const ArabicRenderStatusMap: Record<RenderStatus, string> = {
  PENDING: 'قيد الانتظار',
  QUEUED: 'في طابور الإخراج',
  PREPARING: 'تجهيز وتجميع المشاهد',
  RENDERING: 'جاري إخراج وتصيير الفيديو',
  UPLOADING: 'جاري رفع وحفظ الفيديو في R2',
  VALIDATING: 'فحص ومراجعة الفيديو النهائي',
  READY: 'الفيديو جاهز للتحميل والمشاهدة',
  FAILED: 'فشل إخراج الفيديو',
  CANCELLED: 'تم إلغاء الإخراج',
  SUPERSEDED: 'نسخة مستبدلة',
};

export function getArabicRenderStatus(status: string): string {
  return ArabicRenderStatusMap[status as RenderStatus] || status;
}

/**
 * Render Error Codes & Arabic Mappings
 */
export const RenderErrorCodeEnum = z.enum([
  'RENDER_MANIFEST_INVALID',
  'RENDER_ASSET_MISSING',
  'RENDER_ASSET_UNREADABLE',
  'RENDER_ENGINE_ERROR',
  'RENDER_TIMEOUT',
  'RENDER_DISK_ERROR',
  'RENDER_UPLOAD_ERROR',
  'RENDER_VALIDATION_ERROR',
  'RENDER_ENGINE_NOT_CONFIGURED',
]);

export type RenderErrorCode = z.infer<typeof RenderErrorCodeEnum>;

export const ArabicRenderErrorMap: Record<RenderErrorCode, string> = {
  RENDER_MANIFEST_INVALID: 'بيانات ومخطط إخراج الفيديو غير صالحة',
  RENDER_ASSET_MISSING: 'إحدى المواد البصرية أو الصوتية المطلوبة للمشهد مفقودة',
  RENDER_ASSET_UNREADABLE: 'تعذر قراءة أو تحميل ملف الوسائط من مساحة التخزين',
  RENDER_ENGINE_ERROR: 'حدث خطأ أثناء معالجة وتصيير الفيديو عبر محرك الإخراج',
  RENDER_TIMEOUT: 'تجاوزت عملية إخراج الفيديو الحد الزمني المسموح به',
  RENDER_DISK_ERROR: 'مساحة تخزين الملفات المؤقتة غير كافية',
  RENDER_UPLOAD_ERROR: 'فشل رفع ملف الفيديو النهائي المكتمل إلى R2',
  RENDER_VALIDATION_ERROR: 'فشل الفحص الفني لجودة وأبعاد وحاوية ملف الفيديو MP4',
  RENDER_ENGINE_NOT_CONFIGURED: 'محرك إخراج الفيديو الحقيقي (Remotion) غير مكوّن في هذا النظام',
};

export function getArabicRenderError(code: string): string {
  return ArabicRenderErrorMap[code as RenderErrorCode] || code;
}

/**
 * Render Callback Payload for n8n & Worker
 */
export const RenderCallbackPayloadSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  job_id: z.string().min(1),
  video_id: z.string().min(1),
  render_id: z.string().min(1),
  event_id: z.string().min(1),
  status: RenderStatusEnum,
  stage: z.string().default('FINAL_ASSEMBLY'),
  progress: z.number().int().min(0).max(100).default(0),
  message: z.string().optional(),
  render_output: z
    .object({
      storageProvider: z.string().default('r2'),
      bucket: z.string(),
      objectKey: z.string(),
      mimeType: z.string().default('video/mp4'),
      sizeBytes: z.number().int().nonnegative(),
      durationSeconds: z.number().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      fps: z.number().int().positive().default(30),
      checksum: z.string(),
      downloadUrl: z.string().optional(),
    })
    .optional(),
  error: z
    .object({
      code: RenderErrorCodeEnum,
      message: z.string().default('حدث خطأ في الإخراج'),
      details: z.unknown().optional(),
    })
    .optional(),
});

export type RenderCallbackPayload = z.infer<typeof RenderCallbackPayloadSchema>;

/**
 * Builds deterministic R2 object path for final rendered MP4s
 */
export function buildFinalRenderR2Key(params: {
  userId?: string;
  projectId?: string;
  videoId: string;
  renderId: string;
  version: number;
}): string {
  const userSegment = params.userId ? `users/${params.userId}` : 'users/default';
  const projectSegment = params.projectId ? `projects/${params.projectId}` : 'projects/default';
  return `video-factory/${userSegment}/${projectSegment}/videos/${params.videoId}/renders/${params.renderId}/final-v${params.version}.mp4`;
}
