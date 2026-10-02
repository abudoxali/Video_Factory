import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  type RenderManifest,
  type RenderStatus,
  type RenderErrorCode,
  RenderManifestSchema,
  buildFinalRenderR2Key,
} from '@video-factory/contracts';
import { createStorageProvider, type StorageProvider } from '@video-factory/providers';
import {
  createRenderTransaction,
  updateRenderStatusTransaction,
  recordRenderRunTransaction,
} from '@video-factory/database';
import {
  getDefaultRenderEngine,
  RenderArtifactValidationError,
  RenderEngineNotConfiguredError,
  type RenderEngine,
} from './engine';

export interface RenderServiceOptions {
  storageProvider?: StorageProvider;
  persistToDb?: boolean;
  tempDir?: string;
  /**
   * Explicit render engine. Tests inject explicit doubles here. When omitted,
   * the real Remotion engine is used and fails closed with
   * RENDER_ENGINE_NOT_CONFIGURED if the toolchain is not wired.
   */
  renderEngine?: RenderEngine;
}

export interface RenderExecutionResult {
  success: boolean;
  renderId: string;
  videoId: string;
  version: number;
  status: RenderStatus;
  objectKey?: string;
  bucket?: string;
  sizeBytes?: number;
  checksum?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  latencyMs: number;
  error?: {
    code: RenderErrorCode;
    message: string;
    details?: unknown;
  };
}

export class RenderService {
  private readonly storage: StorageProvider;
  private readonly persistToDb: boolean;
  private readonly tempBaseDir: string;
  private readonly renderEngine?: RenderEngine;

  constructor(options?: RenderServiceOptions) {
    this.storage = options?.storageProvider || createStorageProvider();
    this.persistToDb = options?.persistToDb ?? true;
    this.tempBaseDir = options?.tempDir || path.join(os.tmpdir(), 'video-factory-renders');
    this.renderEngine = options?.renderEngine;
  }

  /**
   * Validates render manifest and scene readiness
   */
  public validateManifest(manifest: RenderManifest): { valid: boolean; error?: string } {
    const parseResult = RenderManifestSchema.safeParse(manifest);
    if (!parseResult.success) {
      return {
        valid: false,
        error: `بيانات مخطط الإخراج غير صالحة: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
      };
    }

    // Check scene media readiness
    for (const scene of manifest.scenes) {
      if (scene.mediaStrategy === 'STOCK') {
        return {
          valid: false,
          error: `المشهد #${scene.position} محدد كمادة مكتبية (STOCK) وبانتظار تزويده بالمادة قبل الإخراج`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Executes end-to-end rendering for a validated RenderManifest
   */
  public async renderVideo(params: {
    manifest: RenderManifest;
    jobId?: string;
    userId?: string;
    projectId?: string;
    version?: number;
  }): Promise<RenderExecutionResult> {
    const startTime = Date.now();
    const { manifest, jobId, userId, projectId, version = 1 } = params;
    const renderId = manifest.renderId;
    const videoId = manifest.videoId;

    // 1. Validate Manifest
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      const errorMsg = validation.error || 'مخطط الإخراج غير صالح';
      return {
        success: false,
        renderId,
        videoId,
        version,
        status: 'FAILED',
        latencyMs: Date.now() - startTime,
        error: {
          code: 'RENDER_MANIFEST_INVALID',
          message: errorMsg,
        },
      };
    }

    const jobTempDir = path.join(this.tempBaseDir, renderId);
    let outputFilePath = '';

    try {
      // 2. Prepare temp directory
      if (!fs.existsSync(jobTempDir)) {
        fs.mkdirSync(jobTempDir, { recursive: true });
      }

      // 3. Database registration if persistToDb
      if (this.persistToDb) {
        await createRenderTransaction(
          {
            id: renderId,
            videoId,
            version,
            status: 'RENDERING',
            width: manifest.composition.width,
            height: manifest.composition.height,
            fps: manifest.composition.fps,
            durationSeconds: String(manifest.composition.durationSeconds),
            durationFrames: manifest.composition.durationInFrames,
            manifestJson: manifest as any,
          },
          { jobId }
        );
      }

      // 4. Render MP4 file through the configured render engine
      outputFilePath = path.join(jobTempDir, `render-${renderId}.mp4`);
      await this.renderOutput(manifest, outputFilePath);

      // 5. Validate Output File
      const fileStats = fs.statSync(outputFilePath);
      if (fileStats.size === 0) {
        throw new Error('حجم ملف الفيديو الناتج 0 بايت (ملف فارغ)');
      }

      const fileBuffer = fs.readFileSync(outputFilePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 6. Upload Final Video to Cloudflare R2
      const finalR2Key = buildFinalRenderR2Key({
        userId,
        projectId,
        videoId,
        renderId,
        version,
      });

      const uploadResult = await this.storage.put(finalR2Key, fileBuffer, {
        contentType: 'video/mp4',
      });

      // 7. Update Database to READY
      if (this.persistToDb) {
        await updateRenderStatusTransaction(
          renderId,
          {
            status: 'READY',
            bucket: uploadResult.bucket,
            objectKey: uploadResult.objectKey,
            sizeBytes: uploadResult.sizeBytes,
            checksum,
            durationSeconds: String(manifest.composition.durationSeconds),
            completedAt: new Date(),
          },
          {
            jobId,
            latencyMs: Date.now() - startTime,
            message: 'تم الانتهاء من إخراج وحفظ الفيديو النهائي بنجاح في R2',
          }
        );
      }

      return {
        success: true,
        renderId,
        videoId,
        version,
        status: 'READY',
        objectKey: uploadResult.objectKey,
        bucket: uploadResult.bucket,
        sizeBytes: uploadResult.sizeBytes,
        checksum,
        durationSeconds: manifest.composition.durationSeconds,
        width: manifest.composition.width,
        height: manifest.composition.height,
        fps: manifest.composition.fps,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const error = err as Error;
      const latencyMs = Date.now() - startTime;
      const errorCode: RenderErrorCode =
        err instanceof RenderEngineNotConfiguredError
          ? 'RENDER_ENGINE_NOT_CONFIGURED'
          : err instanceof RenderArtifactValidationError
            ? 'RENDER_VALIDATION_ERROR'
            : 'RENDER_ENGINE_ERROR';

      if (this.persistToDb) {
        await updateRenderStatusTransaction(
          renderId,
          { status: 'FAILED' },
          {
            jobId,
            latencyMs,
            errorCode,
            errorMessage: error.message,
          }
        );
      }

      return {
        success: false,
        renderId,
        videoId,
        version,
        status: 'FAILED',
        latencyMs,
        error: {
          code: errorCode,
          message: error.message || 'حدث خطأ أثناء تصيير الفيديو',
        },
      };
    } finally {
      // 8. Safely clean up temporary files
      try {
        if (fs.existsSync(jobTempDir)) {
          fs.rmSync(jobTempDir, { recursive: true, force: true });
        }
      } catch (cleanErr) {
        console.error('Failed to clean up render temp dir:', cleanErr);
      }
    }
  }

  /**
   * Executes the configured render engine. No engine is configured means the
   * real Remotion path — which fails closed when the toolchain is absent —
   * is used. Synthetic output is never produced as a fallback.
   */
  private async renderOutput(manifest: RenderManifest, outputPath: string): Promise<void> {
    const engine = this.renderEngine || getDefaultRenderEngine();
    await engine.render(manifest, outputPath);
  }
}
