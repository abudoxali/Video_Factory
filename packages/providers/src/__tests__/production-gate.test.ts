import { describe, it, expect, afterEach, vi } from 'vitest';
import { ProductionConfigError } from '@video-factory/contracts';
import {
  createPublishingProvider,
  createAnalyticsProvider,
  createStorageProvider,
  createVideoProvider,
  createImageProvider,
  createVoiceProvider,
  MockStorageProvider,
  MockVoiceProvider,
  MediaCoordinator,
  PublishingError,
  encryptToken,
} from '../index';
import type { VideoProvider } from '../video/types';
import type {
  VideoGenerationRequest,
  VideoGenerationSubmission,
  VideoGenerationStatus,
} from '@video-factory/contracts';

/**
 * Production Reality Gate — provider-layer proofs.
 * Production must fail closed: no mock fallbacks, no dummy credentials,
 * no fake media bytes persisted as READY.
 */
describe('Production reality gate for provider factories', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  function prod(overrides: Record<string, string | undefined> = {}) {
    process.env = { ...originalEnv, ...overrides };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    delete process.env.VIDEO_FACTORY_USE_MOCK_PROVIDERS;
  }

  it('publishing factory throws instead of silently selecting MockPublishingProvider', () => {
    prod({ GOOGLE_OAUTH_CLIENT_ID: undefined, GOOGLE_OAUTH_CLIENT_SECRET: undefined });
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    expect(() => createPublishingProvider('YOUTUBE')).toThrow(PublishingError);
    try {
      createPublishingProvider('INSTAGRAM');
      expect.unreachable();
    } catch (err) {
      expect((err as PublishingError).code).toBe('PUBLISH_NOT_CONFIGURED');
    }
  });

  it('production never honors a mock publishing request', () => {
    prod({ GOOGLE_OAUTH_CLIENT_ID: 'real', GOOGLE_OAUTH_CLIENT_SECRET: 'real' });
    expect(() => createPublishingProvider('YOUTUBE', { forceMock: true })).toThrow(
      /not allowed in production/
    );
  });

  it('analytics factory fails closed in production when unconfigured', () => {
    prod();
    delete process.env.META_APP_ID;
    expect(() => createAnalyticsProvider('INSTAGRAM')).toThrow(ProductionConfigError);
  });

  it('R2 storage refuses dummy credentials in production', () => {
    prod();
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    expect(() => createStorageProvider('r2')).toThrow(ProductionConfigError);
  });

  it('explicit mock storage/provider selection is rejected in production', () => {
    prod();
    expect(() => createStorageProvider('mock')).toThrow(ProductionConfigError);
    expect(() => createVideoProvider('mock')).toThrow(ProductionConfigError);
    expect(() => createImageProvider('mock')).toThrow(ProductionConfigError);
    expect(() => createVoiceProvider('mock')).toThrow(ProductionConfigError);
  });

  it('token encryption refuses the embedded dev key in production', () => {
    prod();
    delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken('tok')).toThrow(ProductionConfigError);
  });
});

/**
 * Media pipeline truthfulness: AI_VIDEO scenes must never persist a fake MP4
 * and must track the provider's real asynchronous state.
 */
describe('MediaCoordinator production-truthful video handling', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  class ScriptedVideoProvider implements VideoProvider {
    public readonly name = 'scripted-video';
    public readonly defaultModel = 'scripted-v1';
    constructor(
      private readonly submission: VideoGenerationSubmission,
      private readonly status: VideoGenerationStatus
    ) {}
    async generate(_req: VideoGenerationRequest): Promise<VideoGenerationSubmission> {
      return this.submission;
    }
    async getStatus(_requestId: string): Promise<VideoGenerationStatus> {
      return this.status;
    }
  }

  const baseScene = {
    id: 'scn_gate_1',
    videoId: 'vid_gate_1',
    position: 1,
    narration: '',
    visualDescription: 'scene',
    visualPrompt: 'prompt',
    mediaStrategy: 'AI_VIDEO' as const,
    durationSeconds: 5,
  };

  const okSubmission: VideoGenerationSubmission = {
    success: true,
    provider: 'scripted-video',
    model: 'scripted-v1',
    requestId: 'req_gate_1',
    status: 'PROCESSING',
  };

  it('keeps scene GENERATING and persists nothing while provider is PROCESSING', async () => {
    const storage = new MockStorageProvider();
    const putSpy = vi.spyOn(storage, 'put');
    const coordinator = new MediaCoordinator({
      videoProvider: new ScriptedVideoProvider(okSubmission, {
        requestId: 'req_gate_1',
        status: 'PROCESSING',
        progress: 40,
      }),
      storageProvider: storage,
      persistToDb: false,
    });

    const res = await coordinator.processSceneMedia({ scene: baseScene as any, videoId: 'vid_gate_1' });
    expect(res.mediaState).toBe('GENERATING');
    expect(res.visualObjectKey).toBeUndefined();
    expect(res.providerRequestId).toBe('req_gate_1');
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('marks scene FAILED when provider reports FAILED', async () => {
    const coordinator = new MediaCoordinator({
      videoProvider: new ScriptedVideoProvider(okSubmission, {
        requestId: 'req_gate_1',
        status: 'FAILED',
        error: { code: 'MEDIA_PROVIDER_ERROR', message: 'provider died' },
      }),
      storageProvider: new MockStorageProvider(),
      persistToDb: false,
    });

    const res = await coordinator.processSceneMedia({ scene: baseScene as any, videoId: 'vid_gate_1' });
    expect(res.mediaState).toBe('FAILED');
    expect(res.error).toBe('provider died');
  });

  it('marks FAILED when provider completes but returns no media bytes', async () => {
    const storage = new MockStorageProvider();
    const putSpy = vi.spyOn(storage, 'put');
    const coordinator = new MediaCoordinator({
      videoProvider: new ScriptedVideoProvider(okSubmission, {
        requestId: 'req_gate_1',
        status: 'COMPLETED',
      }),
      storageProvider: storage,
      persistToDb: false,
    });

    const res = await coordinator.processSceneMedia({ scene: baseScene as any, videoId: 'vid_gate_1' });
    expect(res.mediaState).toBe('FAILED');
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('persists only real downloaded bytes when COMPLETED with videoUrl', async () => {
    const realBytes = Buffer.from('real-video-bytes-from-provider');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => realBytes.buffer.slice(realBytes.byteOffset, realBytes.byteOffset + realBytes.length),
      }))
    );

    const storage = new MockStorageProvider();
    const coordinator = new MediaCoordinator({
      videoProvider: new ScriptedVideoProvider(okSubmission, {
        requestId: 'req_gate_1',
        status: 'COMPLETED',
        videoUrl: 'https://provider.example.com/out.mp4',
        mimeType: 'video/mp4',
      }),
      storageProvider: storage,
      persistToDb: false,
    });

    const res = await coordinator.processSceneMedia({ scene: baseScene as any, videoId: 'vid_gate_1' });
    expect(res.mediaState).toBe('READY');
    expect(res.visualObjectKey).toContain('video');
    const head = await storage.head(res.visualObjectKey!);
    expect(head.exists).toBe(true);
    expect(head.sizeBytes).toBe(realBytes.length);
  });

  it('never writes the legacy mock-mp4-video-stream placeholder', async () => {
    const storage = new MockStorageProvider();
    const putSpy = vi.spyOn(storage, 'put');
    const coordinator = new MediaCoordinator({
      videoProvider: new ScriptedVideoProvider(okSubmission, {
        requestId: 'req_gate_1',
        status: 'PROCESSING',
      }),
      storageProvider: storage,
      voiceProvider: new MockVoiceProvider(),
      persistToDb: false,
    });

    const res = await coordinator.processSceneMedia({ scene: baseScene as any, videoId: 'vid_gate_1' });
    expect(res.mediaState).not.toBe('READY');
    for (const call of putSpy.mock.calls) {
      const body = call[1];
      const asBuf = Buffer.isBuffer(body) ? body : Buffer.from(body as any);
      expect(asBuf.toString()).not.toContain('mock-mp4-video-stream');
    }
  });
});
