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
  getVideoMediaAssets,
  saveMediaAssetTransaction,
  updateSceneMediaStateTransaction,
  recordMediaRunTransaction,
  getLatestMediaRunForScene,
  updateMediaRunStatus,
  type VideoPlanDetails,
  type MediaAssetEntity,
  type MediaRunEntity,
} from '@video-factory/database';

export interface MediaCoordinatorOptions {
  imageProvider?: ImageProvider;
  videoProvider?: VideoProvider;
  voiceProvider?: VoiceProvider;
  storageProvider?: StorageProvider;
  persistToDb?: boolean;
  batchSize?: number;
  /**
   * Test-only seams. Production code paths always resolve the real loaders.
   */
  planLoader?: (videoId: string) => Promise<VideoPlanDetails | null>;
  assetsLoader?: (videoId: string) => Promise<MediaAssetEntity[]>;
  latestMediaRunLoader?: (sceneId: string, type: MediaAssetType) => Promise<MediaRunEntity | null>;
}

/**
 * A PROCESSING media run older than this is treated as abandoned — the
 * provider submission is assumed lost and a fresh submission is allowed.
 */
const STALE_MEDIA_RUN_MS = 30 * 60 * 1000;

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
  providerRequestId?: string;
  /** True when the scene already owned the required persisted assets. */
  skipped?: boolean;
  error?: string;
}

export interface VideoMediaPipelineResult {
  videoId: string;
  totalScenes: number;
  completedScenes: number;
  readyScenes: number;
  awaitingStockScenes: number;
  timingReviewScenes: number;
  generatingScenes: number;
  failedScenes: number;
  /** No scene is still processing at a provider. */
  allResolved: boolean;
  /** Every scene is READY/AWAITING_STOCK/TIMING_REVIEW — safe to finalize. */
  allReady: boolean;
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
  private readonly planLoader?: MediaCoordinatorOptions['planLoader'];
  private readonly assetsLoader?: MediaCoordinatorOptions['assetsLoader'];
  private readonly latestMediaRunLoader?: MediaCoordinatorOptions['latestMediaRunLoader'];

  constructor(options?: MediaCoordinatorOptions) {
    this.imageProvider = options?.imageProvider || createImageProvider();
    this.videoProvider = options?.videoProvider || createVideoProvider();
    this.voiceProvider = options?.voiceProvider || createVoiceProvider();
    this.storageProvider = options?.storageProvider || createStorageProvider();
    this.persistToDb = options?.persistToDb ?? true;
    this.batchSize = options?.batchSize || 3;
    this.planLoader = options?.planLoader;
    this.assetsLoader = options?.assetsLoader;
    this.latestMediaRunLoader = options?.latestMediaRunLoader;
  }

  /**
   * Execute end-to-end media generation pipeline for an approved video plan.
   *
   * Idempotent: scenes that already own ACTIVE assets of the required type are
   * not regenerated, and a pending async video run is polled via its persisted
   * providerRequestId instead of being re-submitted — workflow retries cannot
   * create duplicate external generations.
   */
  public async executeMediaPipeline(params: {
    videoId: string;
    jobId?: string;
    userId?: string;
    projectId?: string;
    sceneId?: string;
    assetTypes?: MediaAssetType[];
  }): Promise<VideoMediaPipelineResult> {
    const { videoId, jobId, userId, projectId, sceneId, assetTypes } = params;

    // 1. Fetch video plan details
    const plan = this.planLoader
      ? await this.planLoader(videoId)
      : await getVideoPlanDetails(videoId);
    if (!plan || !plan.video) {
      throw new Error(`الفيديو ${videoId} غير موجود`);
    }

    if (plan.video.planStatus !== 'APPROVED') {
      throw new Error('لا يمكن توليد الوسائط لخطة غير معتمدة. يجب اعتماد خطة الفيديو أولاً.');
    }

    let rawScenes = plan.scenes || [];
    if (sceneId) {
      rawScenes = rawScenes.filter((s) => s.id === sceneId);
      if (rawScenes.length === 0) {
        throw new Error(`المشهد ${sceneId} غير موجود في خطة الفيديو`);
      }
    }
    if (rawScenes.length === 0) {
      throw new Error('خطة الفيديو لا تحتوي على أي مشاهد للتوليد');
    }

    // Existing persisted assets drive the idempotent skip decisions.
    const existingAssets = this.assetsLoader
      ? await this.assetsLoader(videoId)
      : this.persistToDb
        ? await getVideoMediaAssets(videoId)
        : [];
    const activeAssets = (existingAssets || []).filter((a) => a.status === 'ACTIVE');

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
          existingAssets: activeAssets.filter((a) => a.sceneId === scene.id),
          assetTypes,
        })
      );

      const batchResults = await Promise.all(batchPromises);
      sceneResults.push(...batchResults);
    }

    const readyScenes = sceneResults.filter((r) => r.mediaState === 'READY').length;
    const awaitingStockScenes = sceneResults.filter(
      (r) => r.mediaState === 'AWAITING_STOCK'
    ).length;
    const timingReviewScenes = sceneResults.filter(
      (r) => r.mediaState === 'TIMING_REVIEW_REQUIRED'
    ).length;
    const generatingScenes = sceneResults.filter((r) => r.mediaState === 'GENERATING').length;
    const failedScenes = sceneResults.filter((r) => r.mediaState === 'FAILED').length;
    const completedScenes = readyScenes + awaitingStockScenes;

    return {
      videoId,
      totalScenes: rawScenes.length,
      completedScenes,
      readyScenes,
      awaitingStockScenes,
      timingReviewScenes,
      generatingScenes,
      failedScenes,
      allResolved: generatingScenes === 0,
      allReady: generatingScenes === 0 && failedScenes === 0 && readyScenes + awaitingStockScenes + timingReviewScenes === rawScenes.length,
      sceneResults,
      success: completedScenes > 0 || timingReviewScenes > 0,
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
    existingAssets?: MediaAssetEntity[];
    assetTypes?: MediaAssetType[];
  }): Promise<SceneMediaGenerationResult> {
    const { scene, videoId, jobId, userId, projectId, aspectRatio = '9:16' } = params;
    const strategy = scene.mediaStrategy || 'AI_VIDEO';
    const existingAssets = params.existingAssets || [];
    const legAllowed = (t: MediaAssetType) => !params.assetTypes || params.assetTypes.includes(t);

    const hasActiveAsset = (types: MediaAssetType[]) =>
      existingAssets.some((a) => a.status === 'ACTIVE' && types.includes(a.type as MediaAssetType));

    let mediaState: SceneMediaState = 'GENERATING';
    let visualAssetId: string | undefined;
    let visualObjectKey: string | undefined;
    let voiceAssetId: string | undefined;
    let voiceObjectKey: string | undefined;
    let actualVoiceDuration: number | undefined;
    let isTimingMismatch = false;
    let errorMessage: string | undefined;
    let providerRequestId: string | undefined;

    const narrationText = scene.narration?.trim() || '';
    const voiceRequired = narrationText.length > 0 && legAllowed('VOICE');

    const visualTypesForStrategy: MediaAssetType[] =
      strategy === 'AI_IMAGE' || strategy === 'MIXED'
        ? ['IMAGE']
        : strategy === 'AI_VIDEO'
          ? ['VIDEO']
          : [];

    try {
      // --- Resolve what still needs work ---------------------------------
      const visualReady = hasActiveAsset(visualTypesForStrategy);
      const voiceReady = !voiceRequired || hasActiveAsset(['VOICE']);
      const needsVisual = visualTypesForStrategy.length > 0 && !visualReady;
      const needsVoice = voiceRequired && !voiceReady;

      if (!needsVisual && !needsVoice) {
        // Everything this scene needs is already persisted — reuse on retry.
        const existingVoice = existingAssets.find(
          (a) => a.status === 'ACTIVE' && a.type === 'VOICE'
        );
        const existingVisual = existingAssets.find(
          (a) => a.status === 'ACTIVE' && visualTypesForStrategy.includes(a.type as MediaAssetType)
        );
        mediaState =
          strategy === 'STOCK'
            ? 'AWAITING_STOCK'
            : strategy === 'MOTION_GRAPHICS' || strategy === 'TEXT'
              ? 'READY'
              : visualReady || existingVisual
                ? voiceRequired && !voiceReady
                  ? 'GENERATING'
                  : 'READY'
                : 'GENERATING';
        if (this.persistToDb) {
          await updateSceneMediaStateTransaction(
            scene.id,
            mediaState,
            jobId,
            'وسائط المشهد موجودة مسبقاً — تم الاستئناف دون إعادة توليد'
          );
        }
        return {
          sceneId: scene.id,
          position: scene.position,
          mediaStrategy: strategy,
          mediaState,
          visualAssetId: existingVisual?.id,
          voiceAssetId: existingVoice?.id,
          visualObjectKey: existingVisual?.objectKey,
          voiceObjectKey: existingVoice?.objectKey,
          skipped: true,
        };
      }

      if (this.persistToDb) {
        await updateSceneMediaStateTransaction(scene.id, 'GENERATING', jobId);
      }

      let visualOk = visualReady;
      let hardFailure = false;

      // 1. ROUTING: Visual Asset Generation based on strategy
      if (needsVisual && (strategy === 'AI_IMAGE' || strategy === 'MIXED')) {
        const legRun = await this.beginMediaRun({
          videoId,
          sceneId: scene.id,
          type: 'IMAGE',
          jobId,
        });
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
              { jobId, targetMediaState: 'GENERATING' }
            );
            visualAssetId = saved.id;
          }
          visualObjectKey = objectKey;
          visualOk = true;
          await this.finishMediaRun(legRun, 'COMPLETED', undefined, {
            objectKey: uploadRes.objectKey,
            sizeBytes: uploadRes.sizeBytes,
          });
        } else {
          hardFailure = true;
          errorMessage = imgResult.error?.message || 'فشل توليد صورة المشهد';
          await this.finishMediaRun(legRun, 'FAILED', {
            code: imgResult.error?.code || 'MEDIA_PROVIDER_ERROR',
            message: errorMessage,
          });
        }
      } else if (needsVisual && strategy === 'AI_VIDEO') {
        // Idempotent async submission: reuse an in-flight provider request when
        // one was already recorded for this scene instead of submitting again.
        const pendingRun = await this.getPendingVideoRun(scene.id);
        let submissionRequestId: string | undefined;
        let providerName = this.videoProvider.name;
        let providerModel = this.videoProvider.defaultModel;
        let runForStatus = pendingRun;

        if (pendingRun?.providerRequestId) {
          submissionRequestId = pendingRun.providerRequestId;
          providerName = pendingRun.provider || providerName;
          providerModel = pendingRun.model || providerModel;
        } else {
          const vidSubmission = await this.videoProvider.generate({
            prompt: scene.visualPrompt || scene.visualDescription,
            aspectRatio,
            durationSeconds: scene.durationSeconds || 5,
            sceneId: scene.id,
            videoId,
          });

          if (!vidSubmission.success) {
            hardFailure = true;
            errorMessage = vidSubmission.error?.message || 'فشل توليد فيديو المشهد';
          } else {
            submissionRequestId = vidSubmission.requestId;
            providerName = vidSubmission.provider;
            providerModel = vidSubmission.model;
            runForStatus = await this.beginMediaRun({
              videoId,
              sceneId: scene.id,
              type: 'VIDEO',
              provider: providerName,
              model: providerModel,
              providerRequestId: submissionRequestId,
              jobId,
            });
          }
        }

        if (submissionRequestId) {
          providerRequestId = submissionRequestId;

          // Resolve asynchronous provider state truthfully: a video asset may
          // only become READY when real provider bytes were actually received.
          let videoBuffer: Buffer | undefined;
          let providerStatus: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';

          if (this.videoProvider.getStatus) {
            const statusRes = await this.videoProvider.getStatus(submissionRequestId);
            providerStatus = statusRes.status;

            if (statusRes.status === 'COMPLETED') {
              if (statusRes.buffer) {
                videoBuffer = Buffer.isBuffer(statusRes.buffer)
                  ? statusRes.buffer
                  : Buffer.from(statusRes.buffer as ArrayBuffer);
              } else if (statusRes.videoUrl) {
                videoBuffer = await this.downloadProviderMedia(statusRes.videoUrl);
              }

              if (!videoBuffer || videoBuffer.length === 0) {
                providerStatus = 'FAILED';
                errorMessage =
                  statusRes.error?.message ||
                  'اكتملت عملية المزود دون إرجاع بايتات فيديو فعلية';
              }
            } else if (statusRes.status === 'FAILED') {
              errorMessage = statusRes.error?.message || 'فشل مزود الفيديو في المعالجة';
            }
          }
          // Providers without getStatus cannot confirm completion — the scene
          // stays GENERATING and is never marked READY without real media.

          if (providerStatus === 'COMPLETED' && videoBuffer && videoBuffer.length > 0) {
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
                  provider: providerName,
                  model: providerModel,
                  providerRequestId: submissionRequestId,
                  storageProvider: this.storageProvider.name,
                  bucket: uploadRes.bucket,
                  objectKey: uploadRes.objectKey,
                  mimeType: uploadRes.contentType,
                  sizeBytes: uploadRes.sizeBytes,
                  durationSeconds: String(scene.durationSeconds || 5),
                  checksum: uploadRes.checksum,
                  status: 'ACTIVE',
                },
                { jobId, targetMediaState: 'GENERATING' }
              );
              visualAssetId = saved.id;
            }
            visualObjectKey = objectKey;
            visualOk = true;
            if (runForStatus) {
              await this.finishMediaRun(runForStatus, 'COMPLETED', undefined, {
                objectKey: uploadRes.objectKey,
                sizeBytes: uploadRes.sizeBytes,
              });
            }
          } else if (providerStatus === 'FAILED') {
            hardFailure = true;
            errorMessage = errorMessage || 'فشل توليد فيديو المشهد';
            if (runForStatus) {
              await this.finishMediaRun(runForStatus, 'FAILED', {
                code: 'MEDIA_PROVIDER_ERROR',
                message: errorMessage,
              });
            }
          }
          // QUEUED / PROCESSING — the provider has not produced media yet.
          // The media_run stays PROCESSING so a later poll resumes it.
        }
      } else if (strategy === 'STOCK') {
        mediaState = 'AWAITING_STOCK';
      } else if (strategy === 'MOTION_GRAPHICS' || strategy === 'TEXT') {
        // Composition-time visuals — legitimately no external asset required.
        visualOk = true;
      }

      // 2. ROUTING: Voiceover Generation if narration text exists
      if (needsVoice) {
        const voiceRun = await this.beginMediaRun({
          videoId,
          sceneId: scene.id,
          type: 'VOICE',
          jobId,
        });
        const voiceRes = await this.voiceProvider.synthesize({
          text: narrationText,
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
                targetMediaState: 'GENERATING',
              }
            );
            voiceAssetId = savedVoice.id;
          }
          voiceObjectKey = voiceKey;
          await this.finishMediaRun(voiceRun, 'COMPLETED', undefined, {
            objectKey: uploadVoiceRes.objectKey,
            durationSeconds: voiceRes.actualDurationSeconds,
          });
        } else {
          // Voice is required when narration exists — a silent success here
          // would falsely mark the scene READY without audio.
          hardFailure = true;
          errorMessage = voiceRes.error?.message || 'فشل توليد التعليق الصوتي للمشهد';
          await this.finishMediaRun(voiceRun, 'FAILED', {
            code: voiceRes.error?.code || 'VOICE_GENERATION_ERROR',
            message: errorMessage,
          });
        }
      }

      // --- Final truthful state ------------------------------------------
      if (hardFailure) {
        mediaState = 'FAILED';
      } else if (providerRequestId && !visualOk && !hardFailure) {
        mediaState = 'GENERATING';
      } else if (mediaState === 'AWAITING_STOCK') {
        // unchanged
      } else if (isTimingMismatch && visualOk) {
        mediaState = 'TIMING_REVIEW_REQUIRED';
      } else if (visualOk && (voiceReady || !voiceRequired || voiceObjectKey)) {
        mediaState = 'READY';
      } else if (!visualOk && voiceObjectKey) {
        mediaState = 'GENERATING';
      } else {
        mediaState = 'GENERATING';
      }

      if (this.persistToDb) {
        await updateSceneMediaStateTransaction(
          scene.id,
          mediaState,
          jobId,
          mediaState === 'FAILED'
            ? errorMessage
            : mediaState === 'READY'
              ? 'اكتملت وسائط المشهد وتم تخزينها'
              : mediaState === 'GENERATING'
                ? 'توليد وسائط المشهد قيد التنفيذ لدى المزود'
                : undefined
        );
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
        providerRequestId,
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
        providerRequestId,
        error: error.message,
      };
    }
  }

  /**
   * Latest PROCESSING video run for the scene, unless it went stale.
   * Stale runs are marked FAILED so a retry may submit a fresh request.
   */
  private async getPendingVideoRun(sceneId: string): Promise<MediaRunEntity | null> {
    if (!this.persistToDb && !this.latestMediaRunLoader) return null;
    const run = this.latestMediaRunLoader
      ? await this.latestMediaRunLoader(sceneId, 'VIDEO')
      : await getLatestMediaRunForScene(sceneId, 'VIDEO');
    if (!run || run.status !== 'PROCESSING' || !run.providerRequestId) return null;

    const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    if (Date.now() - startedAt > STALE_MEDIA_RUN_MS) {
      await updateMediaRunStatus(run.id, {
        status: 'FAILED',
        completedAt: new Date(),
        errorCode: 'MEDIA_TIMEOUT',
        errorMessage: 'انتهت مهلة طلب توليد الفيديو لدى المزود',
      }).catch(() => null);
      return null;
    }
    return run;
  }

  private async beginMediaRun(params: {
    videoId: string;
    sceneId: string;
    type: MediaAssetType;
    provider?: string;
    model?: string;
    providerRequestId?: string;
    jobId?: string;
  }): Promise<MediaRunEntity | null> {
    if (!this.persistToDb) return null;
    try {
      return await recordMediaRunTransaction({
        videoId: params.videoId,
        sceneId: params.sceneId,
        type: params.type,
        provider: params.provider || 'unknown',
        model: params.model || 'unknown',
        providerRequestId: params.providerRequestId || null,
        status: 'PROCESSING',
        startedAt: new Date(),
      });
    } catch {
      return null;
    }
  }

  private async finishMediaRun(
    run: MediaRunEntity | null,
    status: 'COMPLETED' | 'FAILED',
    error?: { code: string; message: string },
    outputMetadata?: Record<string, unknown>
  ): Promise<void> {
    if (!run || !this.persistToDb) return;
    try {
      await updateMediaRunStatus(run.id, {
        status,
        completedAt: new Date(),
        latencyMs: run.startedAt ? Date.now() - new Date(run.startedAt).getTime() : undefined,
        errorCode: error?.code,
        errorMessage: error?.message,
        outputMetadata,
      });
    } catch {
      /* telemetry failure must not break the media path */
    }
  }

  /**
   * Downloads generated media bytes from a provider-hosted URL.
   * Returns undefined when the provider did not return real bytes.
   */
  private async downloadProviderMedia(url: string): Promise<Buffer | undefined> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return undefined;
      const arr = await res.arrayBuffer();
      const buf = Buffer.from(arr);
      return buf.length > 0 ? buf : undefined;
    } catch {
      return undefined;
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
