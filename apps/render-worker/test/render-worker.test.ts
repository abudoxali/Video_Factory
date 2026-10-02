import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { RenderService } from '../src/render/RenderService';
import { RemotionRenderEngine, type RenderEngine } from '../src/render/engine';
import { MockStorageProvider } from '@video-factory/providers';
import type { RenderManifest } from '@video-factory/contracts';

/**
 * Explicit test double for the render engine. Writes a minimal deterministic
 * file so RenderService orchestration (validation → render → checksum →
 * upload → READY) can be exercised without a real Remotion toolchain.
 * Never used by production code paths.
 */
class ExplicitTestRenderEngine implements RenderEngine {
  public readonly name = 'explicit-test-engine';
  public async render(manifest: RenderManifest, outputPath: string): Promise<void> {
    const payload = Buffer.from(
      `TEST_RENDER_OUTPUT:${manifest.renderId}:${manifest.videoId}:${manifest.composition.width}x${manifest.composition.height}@${manifest.composition.fps}fps`
    );
    fs.writeFileSync(outputPath, payload);
  }
}

describe('Render Worker & RenderService Suite (Phase 04)', () => {
  const validManifest: RenderManifest = {
    version: '1.0',
    renderId: 'rnd_test_worker_1',
    videoId: 'vid_test_100',
    title: 'فيديو تجريبي للمرحلة 04',
    language: 'ar',
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 150,
      durationSeconds: 5,
      aspectRatio: '9:16',
    },
    scenes: [
      {
        sceneId: 'scn_1',
        position: 1,
        startFrame: 0,
        durationFrames: 150,
        durationSeconds: 5,
        mediaStrategy: 'AI_IMAGE',
        visualAsset: {
          url: 'https://mock-r2.local/image.png',
          type: 'IMAGE',
          fit: 'cover',
          animation: 'KEN_BURNS',
        },
        narrationAsset: {
          url: 'https://mock-r2.local/voice.mp3',
          durationSeconds: 5,
          startFrame: 0,
          durationFrames: 150,
          volume: 1,
        },
        visualDescription: 'Establishing shot of modern office',
        transition: { type: 'FADE', durationFrames: 15 },
        layout: { template: 'default', theme: 'dark', backgroundColor: '#0b0f19' },
        captions: [
          {
            id: 'cap_1',
            text: 'مرحباً بكم في مصنع الفيديو',
            sceneId: 'scn_1',
            startFrame: 0,
            endFrame: 150,
            durationFrames: 150,
            startTime: 0,
            endTime: 5,
            isRtl: true,
          },
        ],
      },
    ],
    audio: {
      narrationTracks: [
        {
          id: 'nar_1',
          url: 'https://mock-r2.local/voice.mp3',
          type: 'NARRATION',
          startFrame: 0,
          durationFrames: 150,
          volume: 1,
          fadeInFrames: 0,
          fadeOutFrames: 0,
          loop: false,
        },
      ],
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

  it('validates a valid RenderManifest cleanly', () => {
    const service = new RenderService({
      storageProvider: new MockStorageProvider(),
      persistToDb: false,
    });

    const validation = service.validateManifest(validManifest);
    expect(validation.valid).toBe(true);
  });

  it('rejects scenes still in STOCK awaiting state', () => {
    const service = new RenderService({
      storageProvider: new MockStorageProvider(),
      persistToDb: false,
    });

    const stockManifest = {
      ...validManifest,
      scenes: [
        {
          ...validManifest.scenes[0],
          mediaStrategy: 'STOCK' as const,
        },
      ],
    };

    const validation = service.validateManifest(stockManifest);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('STOCK');
  });

  it('executes video rendering via explicit engine, validates output file, and uploads to R2', async () => {
    const storage = new MockStorageProvider();
    const service = new RenderService({
      storageProvider: storage,
      persistToDb: false,
      renderEngine: new ExplicitTestRenderEngine(),
    });

    const result = await service.renderVideo({
      manifest: validManifest,
      userId: 'usr_test',
      projectId: 'prj_test',
      version: 1,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('READY');
    expect(result.objectKey).toContain('final-v1.mp4');
    expect(result.checksum).toBeDefined();
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.durationSeconds).toBe(5);

    // Verify file exists in mock R2 storage
    const head = await storage.head(result.objectKey!);
    expect(head.exists).toBe(true);
  });

  it('fails closed with RENDER_ENGINE_NOT_CONFIGURED when no real engine is wired', async () => {
    const storage = new MockStorageProvider();
    const service = new RenderService({
      storageProvider: storage,
      persistToDb: false,
      // Real engine, but pointed at a nonexistent entry point — deterministic
      // NOT_CONFIGURED path without launching a browser.
      renderEngine: new RemotionRenderEngine({
        entryPoint: 'C:\\nonexistent\\remotion-entry.tsx',
      }),
    });

    const result = await service.renderVideo({
      manifest: validManifest,
      userId: 'usr_test',
      projectId: 'prj_test',
      version: 1,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('RENDER_ENGINE_NOT_CONFIGURED');
  });

  it('propagates engine failures as FAILED renders without READY state', async () => {
    class FailingEngine implements RenderEngine {
      public readonly name = 'failing-test-engine';
      async render(): Promise<void> {
        throw new Error('engine exploded');
      }
    }

    const storage = new MockStorageProvider();
    const service = new RenderService({
      storageProvider: storage,
      persistToDb: false,
      renderEngine: new FailingEngine(),
    });

    const result = await service.renderVideo({
      manifest: validManifest,
      version: 1,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error?.code).toBe('RENDER_ENGINE_ERROR');
  });
});
