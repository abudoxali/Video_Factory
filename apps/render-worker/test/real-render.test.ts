import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { describe, it, expect, afterAll } from 'vitest';
import { RemotionRenderEngine } from '../src/render/engine';
import { RenderService } from '../src/render/RenderService';
import { MockStorageProvider } from '@video-factory/providers';
import { RenderManifestSchema } from '@video-factory/contracts';

const execFileAsync = promisify(execFile);

/**
 * REAL Remotion integration test — exercises the genuine toolchain end to
 * end: esbuild/webpack bundle → headless Chromium → compositor → MP4.
 *
 * Gated behind VF_REAL_RENDER_E2E=1 because it downloads a headless browser
 * on first run and takes tens of seconds. Run explicitly:
 *
 *   VF_REAL_RENDER_E2E=1 pnpm --filter @video-factory/render-worker exec vitest run test/real-render.test.ts
 *
 * Uses only a TEXT scene + Arabic captions — no Gemini/ElevenLabs/R2/n8n or
 * any other external service is required.
 */
const RUN = process.env.VF_REAL_RENDER_E2E === '1';
const suite = RUN ? describe : describe.skip;

const tempDir = path.join(os.tmpdir(), 'vf-real-render-test');
const outputPath = path.join(tempDir, 'real-render-out.mp4');

const manifest = RenderManifestSchema.parse({
  version: '1.0',
  renderId: 'rnd_real_e2e',
  videoId: 'vid_real_e2e',
  title: 'اختبار إخراج حقيقي',
  language: 'ar',
  composition: {
    width: 540,
    height: 960,
    fps: 30,
    durationInFrames: 60,
    durationSeconds: 2,
    aspectRatio: '9:16',
  },
  scenes: [
    {
      sceneId: 'scn_ar_1',
      position: 1,
      startFrame: 0,
      durationFrames: 60,
      durationSeconds: 2,
      mediaStrategy: 'TEXT',
      onScreenText: 'مرحباً من Video Factory',
      visualDescription: 'مشهد نصي عربي تجريبي',
      purpose: 'افتتاحية',
      transition: { type: 'FADE', durationFrames: 10 },
      captions: [
        {
          id: 'cap_ar_1',
          text: 'مرحباً من مصنع الفيديو',
          sceneId: 'scn_ar_1',
          startFrame: 0,
          endFrame: 60,
          durationFrames: 60,
          startTime: 0,
          endTime: 2,
          isRtl: true,
        },
      ],
    },
  ],
  // No audio tracks — a real render must not depend on ElevenLabs.
});

async function ffprobeJson(file: string): Promise<{
  streams: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
  format: { duration?: string; size?: string; format_name?: string };
} | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
      { timeout: 15000 }
    );
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

suite('Real Remotion render (VF_REAL_RENDER_E2E=1)', () => {
  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it(
    'bundles the entry point and renders a real playable MP4 with Arabic text',
    { timeout: 600_000 },
    async () => {
      fs.mkdirSync(tempDir, { recursive: true });

      const engine = new RemotionRenderEngine();
      await engine.render(manifest, outputPath);

      // Artifact assertions: exists, non-zero size, MP4 container signature
      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      const fd = fs.openSync(outputPath, 'r');
      const header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      expect(header.subarray(4, 8).toString('ascii')).toBe('ftyp');

      // ffprobe verification when available
      const probe = await ffprobeJson(outputPath);
      if (probe) {
        const videoStream = probe.streams.find((s) => s.codec_type === 'video');
        expect(videoStream).toBeDefined();
        expect(videoStream?.codec_name).toBe('h264');
        expect(videoStream?.width).toBe(540);
        expect(videoStream?.height).toBe(960);
        const duration = Number(probe.format.duration);
        expect(duration).toBeGreaterThan(1.5);
        expect(duration).toBeLessThanOrEqual(3);
        console.log(
          `[real-render] ${outputPath} — ${stats.size} bytes, ` +
            `codec=${videoStream?.codec_name}, duration=${duration}s, ` +
            `format=${probe.format.format_name}`
        );
      }
    }
  );

  it(
    'produces READY only after real bytes exist, and uploads the real MP4',
    { timeout: 600_000 },
    async () => {
      const storage = new MockStorageProvider();
      const service = new RenderService({
        storageProvider: storage,
        persistToDb: false,
        renderEngine: new RemotionRenderEngine(),
      });

      const result = await service.renderVideo({
        manifest: RenderManifestSchema.parse({ ...manifest, renderId: 'rnd_real_e2e_svc' }),
        userId: 'usr_e2e',
        projectId: 'prj_e2e',
        version: 1,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('READY');
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(result.objectKey).toContain('final-v1.mp4');

      const head = await storage.head(result.objectKey!);
      expect(head.exists).toBe(true);
    }
  );
});
