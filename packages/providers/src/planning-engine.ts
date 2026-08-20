import {
  type CreativeBrief,
  CreativeBriefSchema,
  type VideoScript,
  VideoScriptSchema,
  type VideoChapter,
  VideoChapterSchema,
  type Scene,
  SceneSchema,
  type VideoPlatform,
  type VideoType,
  type VideoLanguage,
  AI_DIRECTOR_PROMPT,
  SCRIPT_GENERATOR_PROMPT,
  CHAPTER_PLANNER_PROMPT,
  SCENE_PLANNER_PROMPT,
  PROMPT_VERSIONS,
  validateAndAdjustTimeline,
} from '@video-factory/contracts';
import {
  saveCreativeBriefTransaction,
  saveVideoScriptTransaction,
  saveScenesTransaction,
  recordAIRun,
} from '@video-factory/database';
import type { LlmProvider } from './llm/types';
import { getLlmProvider } from './llm/factory';

export interface PlanningPipelineInput {
  videoId: string;
  jobId?: string;
  prompt: string;
  platform: VideoPlatform;
  videoType: VideoType;
  durationSeconds: number;
  language: VideoLanguage;
  provider?: LlmProvider;
  persistToDb?: boolean;
}

export interface PlanningPipelineResult {
  success: boolean;
  brief?: CreativeBrief;
  script?: VideoScript;
  chapters?: VideoChapter[];
  scenes?: Scene[];
  totalDurationSeconds?: number;
  error?: string;
}

export class PlanningEngine {
  private defaultProvider: LlmProvider;

  constructor(provider?: LlmProvider) {
    this.defaultProvider = provider || getLlmProvider();
  }

  /**
   * 1. Generate Creative Brief (AI Director - VF-01)
   */
  public async generateCreativeBrief(
    input: PlanningPipelineInput
  ): Promise<CreativeBrief> {
    const provider = input.provider || this.defaultProvider;
    const startTime = new Date();
    const shouldPersist = input.persistToDb !== false;

    const briefJsonSchema = {
      type: 'object',
      properties: {
        workingTitle: { type: 'string' },
        coreIdea: { type: 'string' },
        objective: { type: 'string' },
        targetAudience: { type: 'string' },
        tone: { type: 'string' },
        contentAngle: { type: 'string' },
        hookStrategy: { type: 'string' },
        narrativeStyle: { type: 'string' },
        visualDirection: { type: 'string' },
        pacing: { type: 'string' },
        callToAction: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        constraints: { type: 'array', items: { type: 'string' } },
        planningNotes: { type: 'string' },
        requiresResearch: { type: 'boolean' },
      },
      required: [
        'workingTitle',
        'coreIdea',
        'objective',
        'targetAudience',
        'tone',
        'contentAngle',
        'hookStrategy',
        'narrativeStyle',
        'visualDirection',
      ],
    };

    const result = await provider.generateStructured<CreativeBrief>({
      promptVersion: PROMPT_VERSIONS.DIRECTOR_V1,
      systemPrompt: AI_DIRECTOR_PROMPT.systemPrompt,
      userPrompt: AI_DIRECTOR_PROMPT.buildUserPrompt({
        prompt: input.prompt,
        platform: input.platform,
        videoType: input.videoType,
        durationSeconds: input.durationSeconds,
        language: input.language,
      }),
      jsonSchema: briefJsonSchema,
      validator: (data) => {
        const parsed = CreativeBriefSchema.safeParse({
          ...(data as object),
          videoId: input.videoId,
          platform: input.platform,
          videoType: input.videoType,
          targetDurationSeconds: input.durationSeconds,
          language: input.language,
        });
        if (!parsed.success) {
          return {
            success: false,
            error: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          };
        }
        return { success: true, data: parsed.data };
      },
    });

    if (shouldPersist && input.jobId) {
      await recordAIRun({
        videoId: input.videoId,
        jobId: input.jobId,
        stage: 'AI_DIRECTOR',
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        status: result.success ? 'SUCCESS' : 'FAILED',
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens || null,
        outputTokens: result.outputTokens || null,
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        startedAt: startTime,
        completedAt: new Date(),
      }).catch((e) => console.warn('[AI_RUN_AUDIT_LOG_FAIL]', e));
    }

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'تعذر توليد التوجيه الإبداعي من مزود الذكاء الاصطناعي');
    }

    if (shouldPersist) {
      await saveCreativeBriefTransaction(result.data, input.jobId);
    }

    return result.data;
  }

  /**
   * 2. Generate Video Script (Script Generator - VF-02)
   */
  public async generateScript(
    brief: CreativeBrief,
    jobId?: string,
    providerOverride?: LlmProvider,
    persistToDb: boolean = true
  ): Promise<VideoScript> {
    const provider = providerOverride || this.defaultProvider;
    const startTime = new Date();

    const scriptJsonSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        hook: { type: 'string' },
        fullNarration: { type: 'string' },
        estimatedWordCount: { type: 'integer' },
        estimatedDurationSeconds: { type: 'integer' },
        callToAction: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              narration: { type: 'string' },
              visualNotes: { type: 'string' },
              targetDurationSeconds: { type: 'integer' },
            },
            required: ['id', 'title', 'narration', 'targetDurationSeconds'],
          },
        },
      },
      required: ['title', 'hook', 'fullNarration', 'estimatedDurationSeconds'],
    };

    const result = await provider.generateStructured<VideoScript>({
      promptVersion: PROMPT_VERSIONS.SCRIPT_V1,
      systemPrompt: SCRIPT_GENERATOR_PROMPT.systemPrompt,
      userPrompt: SCRIPT_GENERATOR_PROMPT.buildUserPrompt(brief),
      jsonSchema: scriptJsonSchema,
      validator: (data) => {
        const raw = data as Record<string, unknown>;
        const parsed = VideoScriptSchema.safeParse({
          ...raw,
          videoId: brief.videoId,
          briefId: brief.id,
          language: brief.language,
          estimatedWordCount:
            raw.estimatedWordCount ||
            (typeof raw.fullNarration === 'string' ? raw.fullNarration.split(/\s+/).length : 0),
          estimatedDurationSeconds: raw.estimatedDurationSeconds || brief.targetDurationSeconds,
        });
        if (!parsed.success) {
          return {
            success: false,
            error: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          };
        }
        return { success: true, data: parsed.data };
      },
    });

    if (persistToDb && jobId) {
      await recordAIRun({
        videoId: brief.videoId,
        jobId,
        stage: 'SCRIPT_GENERATION',
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        status: result.success ? 'SUCCESS' : 'FAILED',
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens || null,
        outputTokens: result.outputTokens || null,
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        startedAt: startTime,
        completedAt: new Date(),
      }).catch((e) => console.warn('[AI_RUN_AUDIT_LOG_FAIL]', e));
    }

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'تعذر كتابة السيناريو من مزود الذكاء الاصطناعي');
    }

    if (persistToDb) {
      await saveVideoScriptTransaction(result.data, jobId);
    }

    return result.data;
  }

  /**
   * 3. Generate Long-Form Chapters (Chapter Planning)
   */
  public async generateChapters(
    brief: CreativeBrief,
    jobId?: string,
    providerOverride?: LlmProvider,
    persistToDb: boolean = true
  ): Promise<VideoChapter[]> {
    const provider = providerOverride || this.defaultProvider;
    const startTime = new Date();

    const chaptersJsonSchema = {
      type: 'object',
      properties: {
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'integer' },
              title: { type: 'string' },
              purpose: { type: 'string' },
              summary: { type: 'string' },
              targetDurationSeconds: { type: 'integer' },
              scriptText: { type: 'string' },
            },
            required: ['position', 'title', 'purpose', 'summary', 'targetDurationSeconds'],
          },
        },
      },
      required: ['chapters'],
    };

    const result = await provider.generateStructured<{ chapters: VideoChapter[] }>({
      promptVersion: PROMPT_VERSIONS.CHAPTER_V1,
      systemPrompt: CHAPTER_PLANNER_PROMPT.systemPrompt,
      userPrompt: CHAPTER_PLANNER_PROMPT.buildUserPrompt(brief),
      jsonSchema: chaptersJsonSchema,
      validator: (data) => {
        const raw = data as { chapters?: unknown[] };
        if (!raw || !Array.isArray(raw.chapters)) {
          return { success: false, error: 'المخرجات لا تحتوي على قائمة فصول صحيحة' };
        }
        const validatedChapters: VideoChapter[] = [];
        for (const ch of raw.chapters) {
          const parsed = VideoChapterSchema.safeParse({
            ...(ch as object),
            videoId: brief.videoId,
          });
          if (!parsed.success) {
            return { success: false, error: 'أحد الفصول غير مطابق للمخطط' };
          }
          validatedChapters.push(parsed.data);
        }
        return { success: true, data: { chapters: validatedChapters } };
      },
    });

    if (persistToDb && jobId) {
      await recordAIRun({
        videoId: brief.videoId,
        jobId,
        stage: 'CHAPTER_PLANNING',
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        status: result.success ? 'SUCCESS' : 'FAILED',
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens || null,
        outputTokens: result.outputTokens || null,
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        startedAt: startTime,
        completedAt: new Date(),
      }).catch((e) => console.warn('[AI_RUN_AUDIT_LOG_FAIL]', e));
    }

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'تعذر تقسيم فصول الفيديو الطويل');
    }

    return result.data.chapters;
  }

  /**
   * 4. Generate Scene Plan (Scene Planner - VF-03)
   */
  public async generateScenes(params: {
    brief: CreativeBrief;
    script: VideoScript;
    chapter?: VideoChapter;
    jobId?: string;
    provider?: LlmProvider;
    persistToDb?: boolean;
  }): Promise<Scene[]> {
    const provider = params.provider || this.defaultProvider;
    const startTime = new Date();
    const shouldPersist = params.persistToDb !== false;
    const targetDuration = params.chapter
      ? params.chapter.targetDurationSeconds
      : params.brief.targetDurationSeconds;

    const scenesJsonSchema = {
      type: 'object',
      properties: {
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'integer' },
              purpose: { type: 'string' },
              narration: { type: 'string' },
              onScreenText: { type: 'string' },
              visualDescription: { type: 'string' },
              visualPrompt: { type: 'string' },
              mediaStrategy: {
                type: 'string',
                enum: ['AI_VIDEO', 'AI_IMAGE', 'MOTION_GRAPHICS', 'STOCK', 'TEXT', 'MIXED'],
              },
              animationDirection: { type: 'string' },
              cameraDirection: { type: 'string' },
              transition: { type: 'string' },
              durationSeconds: { type: 'integer' },
              shotType: { type: 'string' },
              lighting: { type: 'string' },
              environment: { type: 'string' },
              subject: { type: 'string' },
              characterNotes: { type: 'string' },
              continuityNotes: { type: 'string' },
            },
            required: ['position', 'visualDescription', 'visualPrompt', 'mediaStrategy', 'durationSeconds'],
          },
        },
      },
      required: ['scenes'],
    };

    const result = await provider.generateStructured<{ scenes: Scene[] }>({
      promptVersion: PROMPT_VERSIONS.SCENE_PLANNER_V1,
      systemPrompt: SCENE_PLANNER_PROMPT.systemPrompt,
      userPrompt: SCENE_PLANNER_PROMPT.buildUserPrompt({
        brief: params.brief,
        script: params.script,
        chapter: params.chapter,
      }),
      jsonSchema: scenesJsonSchema,
      validator: (data) => {
        const raw = data as { scenes?: unknown[] };
        if (!raw || !Array.isArray(raw.scenes) || raw.scenes.length === 0) {
          return { success: false, error: 'المخرجات لا تحتوي على مشاهد صالحة' };
        }

        const validScenes: Scene[] = [];
        for (const sc of raw.scenes) {
          const parsed = SceneSchema.safeParse({
            ...(sc as object),
            videoId: params.brief.videoId,
            chapterId: params.chapter?.id || null,
          });
          if (!parsed.success) {
            return {
              success: false,
              error: `مشهد غير صالح: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
            };
          }
          validScenes.push(parsed.data);
        }

        return { success: true, data: { scenes: validScenes } };
      },
    });

    if (shouldPersist && params.jobId) {
      await recordAIRun({
        videoId: params.brief.videoId,
        jobId: params.jobId,
        stage: 'SCENE_PLANNING',
        provider: result.provider,
        model: result.model,
        promptVersion: result.promptVersion,
        status: result.success ? 'SUCCESS' : 'FAILED',
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens || null,
        outputTokens: result.outputTokens || null,
        errorCode: result.error?.code || null,
        errorMessage: result.error?.message || null,
        startedAt: startTime,
        completedAt: new Date(),
      }).catch((e) => console.warn('[AI_RUN_AUDIT_LOG_FAIL]', e));
    }

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'تعذر تخطيط مشاهد الفيديو');
    }

    // Deterministic timeline calculation and adjustment
    const timeline = validateAndAdjustTimeline(result.data.scenes, targetDuration, 10);
    if (!timeline.valid) {
      console.warn('[TIMELINE_DRIFT_WARNING]', timeline.errors);
    }

    if (shouldPersist) {
      await saveScenesTransaction(
        params.brief.videoId,
        timeline.scenes,
        params.jobId,
        targetDuration
      );
    }

    return timeline.scenes;
  }

  /**
   * Complete End-to-End Planning Pipeline Execution
   */
  public async executeFullPlanningPipeline(
    input: PlanningPipelineInput
  ): Promise<PlanningPipelineResult> {
    try {
      const shouldPersist = input.persistToDb !== false;

      // Step 1: Creative Brief
      const brief = await this.generateCreativeBrief(input);

      // Step 2: Script
      const script = await this.generateScript(brief, input.jobId, input.provider, shouldPersist);

      // Step 3: Chapters (if long-form)
      let chapters: VideoChapter[] | undefined;
      const scenes: Scene[] = [];

      if (input.durationSeconds > 60 || input.videoType === 'long') {
        chapters = await this.generateChapters(brief, input.jobId, input.provider, shouldPersist);

        // Process chapters in bounded sequence to avoid giant single prompt
        for (const chapter of chapters) {
          const chapterScenes = await this.generateScenes({
            brief,
            script,
            chapter,
            jobId: input.jobId,
            provider: input.provider,
            persistToDb: shouldPersist,
          });
          scenes.push(...chapterScenes);
        }
      } else {
        const singleScenes = await this.generateScenes({
          brief,
          script,
          jobId: input.jobId,
          provider: input.provider,
          persistToDb: shouldPersist,
        });
        scenes.push(...singleScenes);
      }

      const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

      return {
        success: true,
        brief,
        script,
        chapters,
        scenes,
        totalDurationSeconds,
      };
    } catch (error: unknown) {
      const err = error as Error;
      console.error('[PLANNING_PIPELINE_ERROR]', err);
      return {
        success: false,
        error: err.message || 'فشلت معالجة التخطيط الإنتاجي للفيديو',
      };
    }
  }
}
