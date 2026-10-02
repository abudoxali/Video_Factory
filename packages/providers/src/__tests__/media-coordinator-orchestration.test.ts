import { describe, it, expect, vi } from 'vitest';
import { MediaCoordinator } from '../media-coordinator';
import { MockStorageProvider } from '../storage/mock';
import type { ImageProvider } from '../image/types';
import type { VideoProvider } from '../video/types';
import type { VoiceProvider } from '../voice/types';
import type { VideoPlanDetails, MediaAssetEntity, MediaRunEntity } from '@video-factory/database';

/**
 * Part 4 orchestration tests: prove the real media boundary never fabricates
 * READY state and that workflow retries reuse persisted work instead of
 * duplicating external provider generations.
 */

const TINY = Buffer.from('fake-media-bytes');

const approvedPlan = (scenes: any[]): VideoPlanDetails =>
  ({
    video: {
      id: 'vid_1',
      planStatus: 'APPROVED',
      aspectRatio: '9:16',
      userId: 'usr_1',
      projectId: 'prj_1',
    },
    brief: null,
    script: null,
    chapters: [],
    scenes,
  }) as unknown as VideoPlanDetails;

const scene = (over: Record<string, unknown> = {}) =>
  ({
    id: 'scn_1',
    videoId: 'vid_1',
    position: 1,
    mediaStrategy: 'AI_IMAGE',
    narration: 'نص السرد التجريبي',
    visualPrompt: 'cinematic opening shot',
    visualDescription: 'opening visual',
    durationSeconds: 5,
    chapterId: null,
    mediaState: 'PENDING',
    ...over,
  }) as any;

const asset = (over: Record<string, unknown> = {}): MediaAssetEntity =>
  ({
    id: 'ast_1',
    videoId: 'vid_1',
    sceneId: 'scn_1',
    type: 'IMAGE',
    status: 'ACTIVE',
    objectKey: 'media/scn_1/image.png',
    ...over,
  }) as unknown as MediaAssetEntity;

const imageProvider = (): ImageProvider & { generate: ReturnType<typeof vi.fn> } => ({
  name: 'test-image',
  defaultModel: 'test-model',
  generate: vi.fn(async () => ({
    success: true,
    provider: 'test-image',
    model: 'test-model',
    mimeType: 'image/png',
    buffer: TINY,
    width: 768,
    height: 1344,
    latencyMs: 5,
  })),
});

const videoProvider = (statusImpl?: (id: string) => Promise<any>): VideoProvider & {
  generate: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
} => ({
  name: 'test-video',
  defaultModel: 'test-model',
  generate: vi.fn(async () => ({
    success: true,
    provider: 'test-video',
    model: 'test-model',
    requestId: 'req_123',
    status: 'PROCESSING' as const,
  })),
  getStatus: vi.fn(
    statusImpl ||
    (async (requestId: string) => ({
      requestId,
      status: 'COMPLETED' as const,
      buffer: TINY,
      mimeType: 'video/mp4',
    }))
  ),
});

const voiceProvider = (ok = true): VoiceProvider & { synthesize: ReturnType<typeof vi.fn> } => ({
  name: 'test-voice',
  defaultModel: 'test-model',
  defaultVoiceId: 'voice_1',
  synthesize: vi.fn(async () =>
    ok
      ? {
        success: true,
        provider: 'test-voice',
        model: 'test-model',
        mimeType: 'audio/mpeg',
        buffer: TINY,
        actualDurationSeconds: 5,
        isTimingMismatch: false,
        latencyMs: 5,
      }
      : {
        success: false,
        provider: 'test-voice',
        model: 'test-model',
        mimeType: 'audio/mpeg',
        actualDurationSeconds: 0,
        latencyMs: 5,
        error: { code: 'VOICE_GENERATION_ERROR' as const, message: 'voice backend down' },
      }
  ),
});

const coordinator = (opts: {
  scenes: any[];
  assets?: MediaAssetEntity[];
  runs?: MediaRunEntity[];
  providers?: Partial<{
    imageProvider: ImageProvider;
    videoProvider: VideoProvider;
    voiceProvider: VoiceProvider;
  }>;
  planStatus?: string;
}) => {
  const plan = approvedPlan(opts.scenes);
  if (opts.planStatus) (plan.video as any).planStatus = opts.planStatus;
  const runs = opts.runs || [];
  return new MediaCoordinator({
    persistToDb: false,
    storageProvider: new MockStorageProvider(),
    imageProvider: opts.providers?.imageProvider || imageProvider(),
    videoProvider: opts.providers?.videoProvider || videoProvider(),
    voiceProvider: opts.providers?.voiceProvider || voiceProvider(),
    planLoader: async () => plan,
    assetsLoader: async () => opts.assets || [],
    latestMediaRunLoader: async (sceneId: string, type: string) =>
      (runs.find((r) => r.sceneId === sceneId && r.type === type) as MediaRunEntity) || null,
  });
};

describe('MediaCoordinator — orchestration truthfulness & idempotency', () => {
  it('refuses to generate media for a plan that is not APPROVED', async () => {
    const mc = coordinator({ scenes: [scene()], planStatus: 'READY_FOR_REVIEW' });
    await expect(mc.executeMediaPipeline({ videoId: 'vid_1' })).rejects.toThrow(
      /معتمدة|APPROVED/i
    );
  });

  it('reuses an existing ACTIVE image asset on retry — no duplicate provider call', async () => {
    const img = imageProvider();
    const mc = coordinator({
      scenes: [scene({ narration: '' })],
      assets: [asset()],
      providers: { imageProvider: img },
    });
    const res = await mc.executeMediaPipeline({ videoId: 'vid_1' });
    expect(res.sceneResults[0].skipped).toBe(true);
    expect(res.sceneResults[0].mediaState).toBe('READY');
    expect(img.generate).not.toHaveBeenCalled();
  });

  it('resumes an in-flight video run via providerRequestId instead of re-submitting', async () => {
    const vid = videoProvider(async (requestId: string) => ({
      requestId,
      status: 'PROCESSING' as const,
    }));
    const pendingRun: MediaRunEntity = {
      id: 'run_1',
      videoId: 'vid_1',
      sceneId: 'scn_1',
      type: 'VIDEO',
      provider: 'test-video',
      model: 'test-model',
      providerRequestId: 'req_existing_9',
      status: 'PROCESSING',
      startedAt: new Date(),
    } as unknown as MediaRunEntity;

    const mc = coordinator({
      scenes: [scene({ mediaStrategy: 'AI_VIDEO', narration: '' })],
      runs: [pendingRun],
      providers: { videoProvider: vid },
    });
    const res = await mc.executeMediaPipeline({ videoId: 'vid_1' });

    expect(vid.generate).not.toHaveBeenCalled();
    expect(vid.getStatus).toHaveBeenCalledWith('req_existing_9');
    expect(res.sceneResults[0].mediaState).toBe('GENERATING');
    expect(res.allResolved).toBe(false);
  });

  it('marks video scene READY only after provider COMPLETED + real bytes persisted', async () => {
    const vid = videoProvider();
    const mc = coordinator({
      scenes: [scene({ mediaStrategy: 'AI_VIDEO', narration: '' })],
      providers: { videoProvider: vid },
    });
    const res = await mc.executeMediaPipeline({ videoId: 'vid_1' });
    expect(vid.generate).toHaveBeenCalledTimes(1);
    expect(vid.getStatus).toHaveBeenCalledWith('req_123');
    expect(res.sceneResults[0].mediaState).toBe('READY');
    expect(res.sceneResults[0].visualObjectKey).toContain('scn_1');
  });

  it('never reaches READY when provider claims completion but returns no bytes', async () => {
    const vid = videoProvider(async (requestId: string) => ({
      requestId,
      status: 'COMPLETED' as const,
      videoUrl: undefined,
    }));
    const mc = coordinator({
      scenes: [scene({ mediaStrategy: 'AI_VIDEO', narration: '' })],
      providers: { videoProvider: vid },
    });
    const res = await mc.executeMediaPipeline({ videoId: 'vid_1' });
    expect(res.sceneResults[0].mediaState).not.toBe('READY');
  });

  it('fails truthfully when voice generation fails — no silent READY', async () => {
    const mc = coordinator({
      scenes: [scene({ mediaStrategy: 'MOTION_GRAPHICS', narration: 'نص' })],
      providers: { voiceProvider: voiceProvider(false) },
    });
    const res = await mc.executeMediaPipeline({ videoId: 'vid_1' });
    expect(res.sceneResults[0].mediaState).toBe('FAILED');
    expect(res.allReady).toBe(false);
  });
});
