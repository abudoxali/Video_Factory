import { z } from 'zod';
import { VideoPlatformEnum, VideoTypeEnum, VideoLanguageEnum } from './videos';
import { PlanStatusEnum } from './jobs';

/**
 * Media Strategy Enum for Scene Planning
 */
export const MediaStrategyEnum = z.enum([
  'AI_VIDEO',
  'AI_IMAGE',
  'MOTION_GRAPHICS',
  'STOCK',
  'TEXT',
  'MIXED',
]);

export type MediaStrategy = z.infer<typeof MediaStrategyEnum>;

export const ArabicMediaStrategyMap: Record<MediaStrategy, string> = {
  AI_VIDEO: 'فيديو ذكاء اصطناعي',
  AI_IMAGE: 'صورة ذكاء اصطناعي',
  MOTION_GRAPHICS: 'موشن جرافيك',
  STOCK: 'لقطات أرشيفية',
  TEXT: 'نصوص وعناوين',
  MIXED: 'وسائط مدمجة',
};

export function getArabicMediaStrategy(strategy: string): string {
  return ArabicMediaStrategyMap[strategy as MediaStrategy] || strategy;
}

/**
 * Creative Brief Schema (Produced by VF-01 AI Director)
 */
export const CreativeBriefSchema = z.object({
  id: z.string().optional(),
  videoId: z.string(),
  workingTitle: z.string().min(1, 'العنوان المبدئي مطلوب'),
  coreIdea: z.string().min(1, 'الفكرة الجوهرية مطلوبة'),
  objective: z.string().min(1, 'الهدف من الفيديو مطلوب'),
  targetAudience: z.string().min(1, 'الجمهور المستهدف مطلوب'),
  platform: VideoPlatformEnum,
  videoType: VideoTypeEnum,
  targetDurationSeconds: z.number().int().positive(),
  language: VideoLanguageEnum.default('ar'),
  tone: z.string().min(1, 'نبرة الصوت والأسلوب مطلوبة'),
  contentAngle: z.string().min(1, 'زاوية التناول مطلوبة'),
  hookStrategy: z.string().min(1, 'استراتيجية الجذب (Hook) مطلوبة'),
  narrativeStyle: z.string().min(1, 'النمط السردي مطلوب'),
  visualDirection: z.string().min(1, 'التوجيه البصري مطلوب'),
  pacing: z.string().default('moderate'),
  callToAction: z.string().nullable().optional(),
  keyPoints: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  planningNotes: z.string().nullable().optional(),
  requiresResearch: z.boolean().default(false),
  status: PlanStatusEnum.default('READY_FOR_REVIEW'),
  version: z.number().int().default(1),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

/**
 * Script Section Schema
 */
export const ScriptSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  narration: z.string(),
  visualNotes: z.string().optional(),
  targetDurationSeconds: z.number().int().positive(),
});

export type ScriptSection = z.infer<typeof ScriptSectionSchema>;

/**
 * Video Script Schema (Produced by VF-02 Script Generator)
 */
export const VideoScriptSchema = z.object({
  id: z.string().optional(),
  videoId: z.string(),
  briefId: z.string().nullable().optional(),
  title: z.string().min(1, 'عنوان السيناريو مطلوب'),
  hook: z.string().min(1, 'جملة الخطاف الافتتاحية مطلوبة'),
  sections: z.array(ScriptSectionSchema).default([]),
  fullNarration: z.string().min(1, 'نص السرد الكامل مطلوب'),
  estimatedWordCount: z.number().int().nonnegative(),
  estimatedDurationSeconds: z.number().int().positive(),
  language: VideoLanguageEnum.default('ar'),
  callToAction: z.string().nullable().optional(),
  scriptVersion: z.number().int().default(1),
  status: PlanStatusEnum.default('READY_FOR_REVIEW'),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type VideoScript = z.infer<typeof VideoScriptSchema>;

/**
 * Video Chapter Schema (For Long-form videos)
 */
export const VideoChapterSchema = z.object({
  id: z.string().optional(),
  videoId: z.string(),
  position: z.number().int().nonnegative(),
  title: z.string().min(1),
  purpose: z.string(),
  summary: z.string(),
  targetDurationSeconds: z.number().int().positive(),
  scriptText: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type VideoChapter = z.infer<typeof VideoChapterSchema>;

/**
 * Scene Schema (Produced by VF-03 Scene Planner)
 */
export const SceneSchema = z.object({
  id: z.string().optional(),
  videoId: z.string(),
  chapterId: z.string().nullable().optional(),
  position: z.number().int().nonnegative(),
  purpose: z.string().default(''),
  narration: z.string().default(''),
  onScreenText: z.string().nullable().optional(),
  visualDescription: z.string().min(1, 'الوصف البصري للمشهد مطلوب'),
  visualPrompt: z.string().min(1, 'الموجه البصري التوليدي مطلوب'),
  mediaStrategy: MediaStrategyEnum.default('AI_VIDEO'),
  animationDirection: z.string().nullable().optional(),
  cameraDirection: z.string().nullable().optional(),
  transition: z.string().nullable().optional(),
  durationSeconds: z.number().int().min(1, 'مدة المشهد يجب أن تكون ثانية واحدة على الأقل'),
  startTime: z.number().int().nonnegative().default(0),
  endTime: z.number().int().nonnegative().default(0),
  shotType: z.string().nullable().optional(),
  lighting: z.string().nullable().optional(),
  environment: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  characterNotes: z.string().nullable().optional(),
  continuityNotes: z.string().nullable().optional(),
  status: z.enum(['PLANNED', 'APPROVED', 'STALE']).default('PLANNED'),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type Scene = z.infer<typeof SceneSchema>;

/**
 * Complete Scene Plan Schema
 */
export const ScenePlanSchema = z.object({
  id: z.string().optional(),
  videoId: z.string(),
  scenes: z.array(SceneSchema).min(1, 'يجب أن يحتوي المخطط على مشهد واحد على الأقل'),
  totalDurationSeconds: z.number().int().positive(),
  targetDurationSeconds: z.number().int().positive(),
  durationToleranceSeconds: z.number().int().default(5),
  mediaStrategiesUsed: z.array(z.string()).default([]),
  status: PlanStatusEnum.default('READY_FOR_REVIEW'),
  version: z.number().int().default(1),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export type ScenePlan = z.infer<typeof ScenePlanSchema>;

/**
 * Planning Configuration Constants
 */
export const PLANNING_CONFIG = {
  WORDS_PER_SECOND: 2.4, // Estimated speech pace for Arabic & English
  SHORT_FORM_MIN_SCENE_DURATION: 3,
  SHORT_FORM_MAX_SCENE_DURATION: 8,
  LONG_FORM_MIN_SCENE_DURATION: 4,
  LONG_FORM_MAX_SCENE_DURATION: 15,
  SHORT_FORM_DURATION_TOLERANCE_SECONDS: 4,
  LONG_FORM_DURATION_TOLERANCE_SECONDS: 15,
  MAX_REPAIR_ATTEMPTS: 2,
} as const;

/**
 * Deterministic Timeline Calculation & Validation
 */
export function calculateTimeline(
  scenes: Array<Omit<Scene, 'startTime' | 'endTime'> & { startTime?: number; endTime?: number }>
): Scene[] {
  let currentOffset = 0;
  return scenes.map((scene, index) => {
    const start = currentOffset;
    const duration = Math.max(1, scene.durationSeconds || 3);
    const end = start + duration;
    currentOffset = end;

    return {
      ...scene,
      position: index + 1,
      startTime: start,
      endTime: end,
      durationSeconds: duration,
    } as Scene;
  });
}

export interface TimelineValidationResult {
  valid: boolean;
  totalDuration: number;
  targetDuration: number;
  differenceSeconds: number;
  scenes: Scene[];
  errors: string[];
}

export function validateAndAdjustTimeline(
  rawScenes: Array<Omit<Scene, 'startTime' | 'endTime'> & { startTime?: number; endTime?: number }>,
  targetDurationSeconds: number,
  toleranceSeconds: number = 5
): TimelineValidationResult {
  const errors: string[] = [];

  if (!rawScenes || rawScenes.length === 0) {
    return {
      valid: false,
      totalDuration: 0,
      targetDuration: targetDurationSeconds,
      differenceSeconds: targetDurationSeconds,
      scenes: [],
      errors: ['خطة المشاهد فارغة، يجب توفير مشهد واحد على الأقل'],
    };
  }

  // Calculate deterministic timestamps
  let computedScenes = calculateTimeline(rawScenes);
  let totalDuration = computedScenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const diff = totalDuration - targetDurationSeconds;
  const absDiff = Math.abs(diff);

  // If drift is small (within tolerance), perform deterministic minor adjustment
  if (absDiff > 0 && absDiff <= toleranceSeconds && computedScenes.length > 0) {
    if (diff > 0) {
      // Need to trim duration from the longest scene(s)
      let toTrim = diff;
      for (let i = computedScenes.length - 1; i >= 0 && toTrim > 0; i--) {
        const scene = computedScenes[i];
        if (scene && scene.durationSeconds > 3) {
          const trimAmount = Math.min(toTrim, scene.durationSeconds - 2);
          scene.durationSeconds -= trimAmount;
          toTrim -= trimAmount;
        }
      }
    } else {
      // Need to add duration to the last scene
      const lastScene = computedScenes[computedScenes.length - 1];
      if (lastScene) {
        lastScene.durationSeconds += Math.abs(diff);
      }
    }

    // Re-calculate after adjustment
    computedScenes = calculateTimeline(computedScenes);
    totalDuration = computedScenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  }

  const finalDiff = Math.abs(totalDuration - targetDurationSeconds);
  const isValid = finalDiff <= toleranceSeconds;

  if (!isValid) {
    errors.push(
      `إجمالي مدة المشاهد (${totalDuration} ثانية) يتجاوز النطاق المسموح للمدة المطلوبة (${targetDurationSeconds} ± ${toleranceSeconds} ثانية)`
    );
  }

  return {
    valid: isValid,
    totalDuration,
    targetDuration: targetDurationSeconds,
    differenceSeconds: totalDuration - targetDurationSeconds,
    scenes: computedScenes,
    errors,
  };
}

/**
 * Complete Planning Result Delivery Payload
 */
export const PlanningPayloadSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  job_id: z.string(),
  video_id: z.string(),
  stage: z.enum([
    'AI_DIRECTOR',
    'SCRIPT_GENERATION',
    'CHAPTER_PLANNING',
    'SCENE_PLANNING',
    'PLAN_VALIDATION',
    'PLAN_READY',
  ]),
  brief: CreativeBriefSchema.optional(),
  script: VideoScriptSchema.optional(),
  chapters: z.array(VideoChapterSchema).optional(),
  scenes: z.array(SceneSchema).optional(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
});

export type PlanningPayload = z.infer<typeof PlanningPayloadSchema>;
