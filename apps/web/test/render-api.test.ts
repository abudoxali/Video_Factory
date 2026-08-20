import { describe, it, expect } from 'vitest';
import { RenderCallbackPayloadSchema, buildFinalRenderR2Key } from '@video-factory/contracts';

describe('Render API Contracts & Ingestion Tests (Phase 04)', () => {
  it('validates a complete render callback payload from n8n / render worker', () => {
    const payload = {
      version: '1.0' as const,
      job_id: 'job_render_100',
      video_id: 'vid_test_100',
      render_id: 'rnd_test_100',
      event_id: 'evt_rnd_123',
      status: 'READY' as const,
      stage: 'RENDER_READY',
      progress: 100,
      message: 'تم إخراج وتصيير الفيديو النهائي بنجاح',
      render_output: {
        storageProvider: 'r2',
        bucket: 'video-factory-media',
        objectKey: 'video-factory/users/usr_1/projects/prj_1/videos/vid_test_100/renders/rnd_test_100/final-v1.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 4520000,
        durationSeconds: 30,
        width: 1080,
        height: 1920,
        fps: 30,
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    };

    const res = RenderCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects invalid render status or missing required render ID', () => {
    const invalidPayload = {
      version: '1.0',
      job_id: 'job_1',
      video_id: 'vid_1',
      render_id: '', // empty
      event_id: 'evt_1',
      status: 'INVALID_STATUS',
    };

    const res = RenderCallbackPayloadSchema.safeParse(invalidPayload);
    expect(res.success).toBe(false);
  });

  it('formats deterministic R2 keys for final MP4 versions', () => {
    const key = buildFinalRenderR2Key({
      videoId: 'vid_456',
      renderId: 'rnd_789',
      version: 2,
    });

    expect(key).toBe(
      'video-factory/users/default/projects/default/videos/vid_456/renders/rnd_789/final-v2.mp4'
    );
  });
});
