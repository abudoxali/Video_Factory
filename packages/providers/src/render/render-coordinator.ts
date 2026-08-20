import {
  type RenderManifest,
  type RenderScene,
  type RenderAudioTrack,
  type OutputPreset,
  OUTPUT_PRESET_CONFIGS,
  DEFAULT_FPS,
  secondsToFrames,
  framesToSeconds,
  normalizeTransition,
  buildCaptionSegments,
  RenderManifestSchema,
} from '@video-factory/contracts';
import {
  getVideoPlanDetails,
  getVideoMediaAssets,
  getActiveVideoRender,
  createRenderTransaction,
  getRenderById,
} from '@video-factory/database';
import { createStorageProvider } from '../storage/factory';
import type { StorageProvider } from '../storage/types';

export interface RenderCoordinatorOptions {
  storageProvider?: StorageProvider;
  fps?: number;
}

export class RenderCoordinator {
  private readonly storage: StorageProvider;
  private readonly fps: number;

  constructor(options?: RenderCoordinatorOptions) {
    this.storage = options?.storageProvider || createStorageProvider();
    this.fps = options?.fps || DEFAULT_FPS;
  }

  /**
   * Builds canonical validated RenderManifest from approved video plan and ready media assets
   */
  public async buildRenderManifest(videoId: string): Promise<RenderManifest> {
    const plan = await getVideoPlanDetails(videoId);
    if (!plan || !plan.video) {
      throw new Error(`الفيديو ${videoId} غير موجود`);
    }

    if (plan.video.planStatus !== 'APPROVED') {
      throw new Error('لا يمكن بناء مخطط الإخراج لخطة فيديو غير معتمدة');
    }

    const rawScenes = plan.scenes || [];
    if (rawScenes.length === 0) {
      throw new Error('خطة الفيديو لا تحتوي على أي مشاهد للإخراج');
    }

    const allAssets = await getVideoMediaAssets(videoId);
    const activeAssets = allAssets.filter((a) => a.status === 'ACTIVE');

    // Determine composition dimensions and aspect ratio
    const preset = (plan.video.aspectRatio || '9:16') as OutputPreset;
    const resConfig = OUTPUT_PRESET_CONFIGS[preset] || OUTPUT_PRESET_CONFIGS['9:16'];

    const renderId = `rnd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Build scenes and calculate deterministic frame math
    let currentFrame = 0;
    const renderScenes: RenderScene[] = [];
    const narrationTracks: RenderAudioTrack[] = [];

    for (let i = 0; i < rawScenes.length; i++) {
      const scene = rawScenes[i];
      const durationSeconds = scene.durationSeconds || 5;
      const durationFrames = secondsToFrames(durationSeconds, this.fps);
      const startFrame = currentFrame;

      // Find active visual asset for this scene
      const sceneVisualAsset = activeAssets.find(
        (a) =>
          a.sceneId === scene.id &&
          (a.type === 'IMAGE' || a.type === 'VIDEO')
      );

      // Find active voice asset for this scene
      const sceneVoiceAsset = activeAssets.find(
        (a) => a.sceneId === scene.id && a.type === 'VOICE'
      );

      // Get signed read URLs for media assets
      let visualUrl: string | undefined;
      if (sceneVisualAsset) {
        const presignedVisual = await this.storage.getSignedReadUrl(
          sceneVisualAsset.objectKey,
          7200,
          sceneVisualAsset.bucket
        );
        visualUrl = presignedVisual.url;
      }

      let voiceUrl: string | undefined;
      if (sceneVoiceAsset) {
        const presignedVoice = await this.storage.getSignedReadUrl(
          sceneVoiceAsset.objectKey,
          7200,
          sceneVoiceAsset.bucket
        );
        voiceUrl = presignedVoice.url;
      }

      // Build caption segments for this scene
      const captionSegments = scene.narration
        ? buildCaptionSegments(scene.narration, startFrame, durationFrames, this.fps, scene.id)
        : [];

      // Add narration track if voice asset exists
      if (voiceUrl) {
        narrationTracks.push({
          id: `nar_${scene.id}_${i + 1}`,
          url: voiceUrl,
          type: 'NARRATION',
          sceneId: scene.id,
          startFrame,
          durationFrames,
          volume: 1.0,
          fadeInFrames: 0,
          fadeOutFrames: 0,
          loop: false,
        });
      }

      renderScenes.push({
        sceneId: scene.id,
        position: scene.position,
        purpose: scene.purpose || undefined,
        chapterId: scene.chapterId || null,
        startFrame,
        durationFrames,
        durationSeconds,
        mediaStrategy: (scene.mediaStrategy || 'AI_VIDEO') as any,
        visualAsset: sceneVisualAsset
          ? {
              assetId: sceneVisualAsset.id,
              url: visualUrl,
              type: sceneVisualAsset.type as 'IMAGE' | 'VIDEO' | 'STOCK',
              fit: 'cover',
              animation: 'KEN_BURNS',
              width: sceneVisualAsset.width || resConfig.width,
              height: sceneVisualAsset.height || resConfig.height,
            }
          : undefined,
        narrationAsset: sceneVoiceAsset
          ? {
              assetId: sceneVoiceAsset.id,
              url: voiceUrl,
              durationSeconds: sceneVoiceAsset.durationSeconds
                ? parseFloat(sceneVoiceAsset.durationSeconds)
                : durationSeconds,
              startFrame,
              durationFrames,
              volume: 1.0,
            }
          : undefined,
        onScreenText: scene.onScreenText || undefined,
        visualDescription: scene.visualDescription,
        visualPrompt: scene.visualPrompt || undefined,
        transition: {
          type: normalizeTransition('FADE'),
          durationFrames: Math.min(15, Math.floor(durationFrames / 3)),
        },
        layout: {
          template: 'default',
          theme: 'dark',
          backgroundColor: '#090d16',
        },
        captions: captionSegments,
      });

      currentFrame += durationFrames;
    }

    const totalDurationFrames = currentFrame;
    const totalDurationSeconds = framesToSeconds(totalDurationFrames, this.fps);

    const manifest: RenderManifest = {
      version: '1.0',
      renderId,
      videoId,
      title: plan.video.title,
      language: 'ar',
      composition: {
        width: resConfig.width,
        height: resConfig.height,
        fps: this.fps,
        durationInFrames: totalDurationFrames,
        durationSeconds: totalDurationSeconds,
        aspectRatio: preset,
      },
      scenes: renderScenes,
      audio: {
        narrationTracks,
        musicTracks: [],
        sfxTracks: [],
        ducking: {
          enabled: true,
          duckedVolume: 0.15,
          normalVolume: 0.6,
          fadeFrames: 15,
        },
      },
      captions: {
        enabled: true,
        style: 'SOCIAL',
        safeAreaMarginPercent: 18,
        primaryColor: '#ffffff',
        highlightColor: '#38bdf8',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        fontSize: 48,
        maxLines: 2,
        rtl: true,
        fontFamily: 'Cairo, sans-serif',
      },
      branding: {
        watermark: { enabled: false, opacity: 0.5, position: 'TOP_RIGHT' },
        introCard: { enabled: false, durationFrames: 60 },
        outroCard: { enabled: false, durationFrames: 90 },
      },
      output: {
        format: 'mp4',
        codec: 'h264',
        audioCodec: 'aac',
        crf: 20,
      },
    };

    // Validate manifest with Zod schema
    const validation = RenderManifestSchema.safeParse(manifest);
    if (!validation.success) {
      throw new Error(
        `فشل التحقق من صحة مخطط الإخراج: ${validation.error.errors.map((e) => e.message).join(', ')}`
      );
    }

    return validation.data;
  }
}
