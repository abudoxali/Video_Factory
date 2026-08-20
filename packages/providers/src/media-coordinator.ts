import crypto from 'crypto';
import { createImageProvider } from './image/factory';
import { createVideoProvider } from './video/factory';
import { createVoiceProvider } from './voice/factory';
import { createStorageProvider } from './storage/factory';
import type { ImageProvider } from './image/types';
import type { VideoProvider } from './video/types';
import type { VoiceProvider } from './voice/types';
import type { StorageProvider } from './storage/types';
import {
  type Scene,
  type MediaAsset,
  type MediaAssetType,
  type SceneMediaState,
  buildR2ObjectKey,
} from '@video-factory/contracts';
import {
  getVideoPlanDetails,
  saveMediaAssetTransaction,
  updateSceneMediaStateTransaction,
  recordMediaRunTransaction,
} from '@video-factory/database';

export interface MediaCoordinatorOptions {
  imageProvider?: ImageProvider;
  videoProvider?: VideoProvider;
  voiceProvider?: VoiceProvider;
  storageProvider?: StorageProvider;
  persistToDb?: boolean;
  batchSize?: number;
}

export interface SceneMediaGenerationResult {
  sceneId: string;
  position: number;
  mediaStrategy: string;
  mediaState: SceneMediaState;
  visualAssetId?: string;
  voiceAssetId?: string;
  visualObjectKey?: string;
  voiceObjectKey?: string;
  actualVoiceDuration?: number;
  isTimingMismatch?: boolean;
  error?: string;
}

export interface VideoMediaPipelineResult {
  videoId: string;
  totalScenes: number;
  completedScenes: number;
  sceneResults: SceneMediaGenerationResult[];
  success: boolean;
}

export class MediaCoordinator {
  private readonly imageProvider: ImageProvider;
  private readonly videoProvider: VideoProvider;
  private readonly voiceProvider: VoiceProvider;
  private readonly storageProvider: StorageProvider;
  private readonly persistToDb: boolean;
  private readonly batchSize: number;

  constructor(options?: MediaCoordinatorOptions) {
    this.imageProvider = options?.imageProvider || createImageProvider();
    this.videoProvider = options?.videoProvider || createVideoProvider();
    this.voiceProvider = options?.voiceProvider || createVoiceProvider();
    this.storageProvider = options?.storageProvider || createStorageProvider();
    this.persistToDb = options?.persistToDb ?? true;
    this.batchSize = options?.batchSize || 3;
  }

  /**
   * Execute end-to-end media generation pipeline for an approved video plan
   */
  public async executeMediaPipeline(params: {
    videoId: string;
    jobId?: string;
    userId?: string;
    projectId?: string;
  }): Promise<VideoMediaPipelineResult> {
    const { videoId, jobId, userId, projectId } = params;

    // 1. Fetch video plan details
    const plan = await getVideoPlanDetails(videoId);
    if (!plan || !plan.video) {
      throw new Error(`الفيديو ${videoId} غير موجود`);
    }

    if (plan.video.planStatus !== 'APPROVED') {
      throw new Error('لا يمكن توليد الوسائط لخطة غير معتمدة. يجب اعتماد خطة الفيديو أولاً.');
    }

    const rawScenes = plan.scenes || [];
    if (rawScenes.length === 0) {
      throw new Error('خطة الفيديو لا تحتوي على أي مشاهد للتوليد');
    }

    const sceneResults: SceneMediaGenerationResult[] = [];

    // 2. Process scenes in controlled batches to prevent overloading rate limits
    for (let i = 0; i < rawScenes.length; i += this.batchSize) {
      const batch = rawScenes.slice(i, i + this.batchSize);
      const batchPromises = batch.map((scene) =>
        this.processSceneMedia({
          scene: scene as any,
          videoId,
          jobId,
          userId,
          projectId,
          aspectRatio: plan.video?.aspectRatio || '9:16',
        })
      );

      const batchResults = await Promise.all(batchPromises);
      sceneResults.push(...batchResults);
    }

    const completedScenes = sceneResults.filter(
      (r) => r.mediaState === 'READY' || r.mediaState === 'AWAITING_STOCK'
    ).length;

    return {
      videoId,
      totalScenes: rawScenes.length,
      completedScenes,
      sceneResults,
      success: completedScenes > 0,
    };
  }

  /**
   * Process media generation for a single scene
   */
  public async processSceneMedia(params: {
    scene: Scene & { id: string };
    videoId: string;
    jobId?: string;
    userId?: string;
    projectId?: string;
    aspectRatio?: string;
  }): Promise<SceneMediaGenerationResult> {
    const { scene, videoId, jobId, userId, projectId, aspectRatio = '9:16' } = params;
    const strategy = scene.mediaStrategy || 'AI_VIDEO';

    let mediaState: SceneMediaState = 'GENERATING';
    let visualAssetId: string | undefined;
    let visualObjectKey: string | undefined;
    let voiceAssetId: string | undefined;
    let voiceObjectKey: string | undefined;
    let actualVoiceDuration: number | undefined;
    let isTimingMismatch = false;
    let errorMessage: string | undefined;

    try {
      if (this.persistToDb) {
        await updateSceneMediaStateTransaction(scene.id, 'GENERATING', jobId);
      }

      // 1. ROUTING: Visual Asset Generation based on strategy
      if (strategy === 'AI_IMAGE' || strategy === 'MIXED') {
        const imgResult = await this.imageProvider.generate({
          prompt: scene.visualPrompt || scene.visualDescription,
          aspectRatio,
          styleContext: scene.visualDescription,
          characterKey: (scene as any).characterKey || undefined,
          sceneId: scene.id,
          videoId,
        });

        if (imgResult.success && imgResult.buffer) {
          const assetId = `ast_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const objectKey = buildR2ObjectKey({
            userId,
            projectId,
            videoId,
            sceneId: scene.id,
            assetType: 'IMAGE',
            assetId,
            extension: 'png',
          });

          const uploadRes = await this.storageProvider.put(objectKey, imgResult.buffer, {
            contentType: imgResult.mimeType || 'image/png',
          });

          if (this.persistToDb) {
            const saved = await saveMediaAssetTransaction(
              {
                videoId,
                sceneId: scene.id,
                chapterId: scene.chapterId || null,
                type: 'IMAGE',
                source: 'GENERATED',
                provider: imgResult.provider,
                model: imgResult.model,
                storageProvider: this.storageProvider.name,
                bucket: uploadRes.bucket,
                objectKey: uploadRes.objectKey,
                mimeType: uploadRes.contentType,
                sizeBytes: uploadRes.sizeBytes,
                width: imgResult.width || 768,
                height: imgResult.height || 1344,
                checksum: uploadRes.checksum,
                status: 'ACTIVE',
              },
              { jobId, targetMediaState: 'READY' }
            );
            visualAssetId = saved.id;
          }
          visualObjectKey = objectKey;
          mediaState = 'READY';
        } else {
          mediaState = 'FAILED';
          errorMessage = imgResult.error?.message || 'فشل توليد صورة المشهد';
        }
      } else if (strategy === 'AI_VIDEO') {
        const vidSubmission = await this.videoProvider.generate({
          prompt: scene.visualPrompt || scene.visualDescription,
          aspectRatio,
          durationSeconds: scene.durationSeconds || 5,
          sceneId: scene.id,
          videoId,
        });

        if (vidSubmission.success) {
          let buffer: Buffer | undefined;
          if (this.videoProvider.getStatus) {
            const statusRes = await this.videoProvider.getStatus(vidSubmission.requestId);
            if (statusRes.buffer) buffer = statusRes.buffer;
          }

          const assetId = `ast_vid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const objectKey = buildR2ObjectKey({
            userId,
            projectId,
            videoId,
            sceneId: scene.id,
            assetType: 'VIDEO',
            assetId,
            extension: 'mp4',
          });

          const videoBuffer = buffer || Buffer.from('mock-mp4-video-stream');
          const uploadRes = await this.storageProvider.put(objectKey, videoBuffer, {
            contentType: 'video/mp4',
          });

          if (this.persistToDb) {
            const saved = await saveMediaAssetTransaction(
              {
                videoId,
                sceneId: scene.id,
                chapterId: scene.chapterId || null,
                type: 'VIDEO',
                source: 'GENERATED',
                provider: vidSubmission.provider,
                model: vidSubmission.model,
                providerRequestId: vidSubmission.requestId,
                storageProvider: this.storageProvider.name,
                bucket: uploadRes.bucket,
                objectKey: uploadRes.objectKey,
                mimeType: uploadRes.contentType,
                sizeBytes: uploadRes.sizeBytes,
                durationSeconds: String(scene.durationSeconds || 5),
                checksum: uploadRes.checksum,
                status: 'ACTIVE',
              },
              { jobId, targetMediaState: 'READY' }
            );
            visualAssetId = saved.id;
          }
          visualObjectKey = objectKey;
          mediaState = 'READY';
        } else {
          mediaState = 'FAILED';
          errorMessage = vidSubmission.error?.message || 'فشل توليد فيديو المشهد';
        }
      } else if (strategy === 'STOCK') {
        mediaState = 'AWAITING_STOCK';
        if (this.persistToDb) {
          await updateSceneMediaStateTransaction(scene.id, 'AWAITING_STOCK', jobId);
        }
      } else if (strategy === 'MOTION_GRAPHICS' || strategy === 'TEXT') {
        mediaState = 'READY';
        if (this.persistToDb) {
          await updateSceneMediaStateTransaction(scene.id, 'READY', jobId);
        }
      }

      // 2. ROUTING: Voiceover Generation if narration text exists
      if (scene.narration && scene.narration.trim().length > 0) {
        const voiceRes = await this.voiceProvider.synthesize({
          text: scene.narration,
          language: 'ar',
          speed: 1.0,
          outputFormat: 'mp3_44100_128',
          targetDurationSeconds: scene.durationSeconds,
          sceneId: scene.id,
          videoId,
        });

        if (voiceRes.success && voiceRes.buffer) {
          const voiceAssetIdGen = `ast_voc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const voiceKey = buildR2ObjectKey({
            userId,
            projectId,
            videoId,
            sceneId: scene.id,
            assetType: 'VOICE',
            assetId: voiceAssetIdGen,
            extension: 'mp3',
          });

          const uploadVoiceRes = await this.storageProvider.put(voiceKey, voiceRes.buffer, {
            contentType: voiceRes.mimeType || 'audio/mpeg',
          });

          actualVoiceDuration = voiceRes.actualDurationSeconds;
          isTimingMismatch = voiceRes.isTimingMismatch || false;

          if (this.persistToDb) {
            const savedVoice = await saveMediaAssetTransaction(
              {
                videoId,
                sceneId: scene.id,
                chapterId: scene.chapterId || null,
                type: 'VOICE',
                source: 'GENERATED',
                provider: voiceRes.provider,
                model: voiceRes.model,
                storageProvider: this.storageProvider.name,
                bucket: uploadVoiceRes.bucket,
                objectKey: uploadVoiceRes.objectKey,
                mimeType: uploadVoiceRes.contentType,
                sizeBytes: uploadVoiceRes.sizeBytes,
                durationSeconds: String(voiceRes.actualDurationSeconds),
                checksum: uploadVoiceRes.checksum,
                status: 'ACTIVE',
              },
              {
                jobId,
                targetMediaState: isTimingMismatch ? 'TIMING_REVIEW_REQUIRED' : mediaState,
              }
            );
            voiceAssetId = savedVoice.id;
          }
          voiceObjectKey = voiceKey;
          if (isTimingMismatch) {
            mediaState = 'TIMING_REVIEW_REQUIRED';
          }
        }
      }

      return {
        sceneId: scene.id,
        position: scene.position,
        mediaStrategy: strategy,
        mediaState,
        visualAssetId,
        voiceAssetId,
        visualObjectKey,
        voiceObjectKey,
        actualVoiceDuration,
        isTimingMismatch,
        error: errorMessage,
      };
    } catch (err: unknown) {
      const error = err as Error;
      if (this.persistToDb) {
        await updateSceneMediaStateTransaction(scene.id, 'FAILED', jobId, error.message);
      }
      return {
        sceneId: scene.id,
        position: scene.position,
        mediaStrategy: strategy,
        mediaState: 'FAILED',
        error: error.message,
      };
    }
  }

  /**
   * Regenerate a single specific asset for a scene (e.g. image, video, voice)
   */
  public async regenerateSceneAsset(params: {
    sceneId: string;
    videoId: string;
    assetType: MediaAssetType;
    promptOverride?: string;
    userId?: string;
    projectId?: string;
  }): Promise<MediaAsset | null> {
    const { sceneId, videoId, assetType, promptOverride, userId, projectId } = params;

    const plan = await getVideoPlanDetails(videoId);
    if (!plan) throw new Error('خطة الفيديو غير موجودة');

    const scene = plan.scenes.find((s) => s.id === sceneId);
    if (!scene) throw new Error('المشهد غير موجود');

    if (assetType === 'IMAGE') {
      const imgRes = await this.imageProvider.generate({
        prompt: promptOverride || scene.visualPrompt || scene.visualDescription,
        aspectRatio: plan.video?.aspectRatio || '9:16',
        sceneId,
        videoId,
      });

      if (!imgRes.success || !imgRes.buffer) {
        throw new Error(imgRes.error?.message || 'فشلت إعادة توليد الصورة');
      }

      const assetId = `ast_img_regen_${Date.now()}`;
      const objectKey = buildR2ObjectKey({
        userId,
        projectId,
        videoId,
        sceneId,
        assetType: 'IMAGE',
        assetId,
        extension: 'png',
      });

      const uploadRes = await this.storageProvider.put(objectKey, imgRes.buffer, {
        contentType: 'image/png',
      });

      if (this.persistToDb) {
        const saved = await saveMediaAssetTransaction(
          {
            videoId,
            sceneId,
            chapterId: scene.chapterId || null,
            type: 'IMAGE',
            source: 'GENERATED',
            provider: imgRes.provider,
            model: imgRes.model,
            storageProvider: this.storageProvider.name,
            bucket: uploadRes.bucket,
            objectKey: uploadRes.objectKey,
            mimeType: uploadRes.contentType,
            sizeBytes: uploadRes.sizeBytes,
            checksum: uploadRes.checksum,
            status: 'ACTIVE',
          },
          { supersedePrior: true, targetMediaState: 'READY' }
        );
        return saved as any;
      }
    } else if (assetType === 'VOICE') {
      const textToSpeak = promptOverride || scene.narration;
      if (!textToSpeak) throw new Error('لا يوجد نص سردي لتوليد الصوت');

      const voiceRes = await this.voiceProvider.synthesize({
        text: textToSpeak,
        language: 'ar',
        speed: 1.0,
        outputFormat: 'mp3_44100_128',
        targetDurationSeconds: scene.durationSeconds,
        sceneId,
        videoId,
      });

      if (!voiceRes.success || !voiceRes.buffer) {
        throw new Error(voiceRes.error?.message || 'فشلت إعادة توليد الصوت');
      }

      const assetId = `ast_voc_regen_${Date.now()}`;
      const objectKey = buildR2ObjectKey({
        userId,
        projectId,
        videoId,
        sceneId,
        assetType: 'VOICE',
        assetId,
        extension: 'mp3',
      });

      const uploadRes = await this.storageProvider.put(objectKey, voiceRes.buffer, {
        contentType: 'audio/mpeg',
      });

      if (this.persistToDb) {
        const saved = await saveMediaAssetTransaction(
          {
            videoId,
            sceneId,
            chapterId: scene.chapterId || null,
            type: 'VOICE',
            source: 'GENERATED',
            provider: voiceRes.provider,
            model: voiceRes.model,
            storageProvider: this.storageProvider.name,
            bucket: uploadRes.bucket,
            objectKey: uploadRes.objectKey,
            mimeType: uploadRes.contentType,
            sizeBytes: uploadRes.sizeBytes,
            durationSeconds: String(voiceRes.actualDurationSeconds),
            checksum: uploadRes.checksum,
            status: 'ACTIVE',
          },
          { supersedePrior: true, targetMediaState: 'READY' }
        );
        return saved as any;
      }
    }

    return null;
  }
}
