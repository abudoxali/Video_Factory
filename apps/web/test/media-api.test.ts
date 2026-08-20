import { describe, it, expect } from 'vitest';
import { MediaCallbackPayloadSchema, buildR2ObjectKey } from '@video-factory/contracts';

describe('Media API Contracts & Storage Path Tests', () => {
  it('validates a complete media callback payload from n8n / provider', () => {
    const payload = {
      version: '1.0' as const,
      job_id: 'job_media_100',
      video_id: 'vid_test_100',
      scene_id: 'scn_1',
      event_id: 'evt_media_img_123',
      stage: 'IMAGE_GENERATION',
      progress: 75,
      media_type: 'IMAGE' as const,
      scene_media_state: 'READY' as const,
      message: 'تم توليد وتخزين صورة المشهد بنجاح',
      asset: {
        videoId: 'vid_test_100',
        sceneId: 'scn_1',
        type: 'IMAGE' as const,
        source: 'GENERATED' as const,
        provider: 'gemini-image',
        model: 'gemini-3.1-flash-image',
        storageProvider: 'r2',
        bucket: 'video-factory-media',
        objectKey: 'video-factory/users/default/projects/default/videos/vid_test_100/scenes/scn_1/image/ast_1.png',
        mimeType: 'image/png',
        sizeBytes: 256000,
        width: 768,
        height: 1344,
        status: 'ACTIVE' as const,
        checksum: 'abc123sha256',
      },
    };

    const res = MediaCallbackPayloadSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects media callback with invalid media type or missing required fields', () => {
    const invalidPayload = {
      version: '1.0',
      job_id: '',
      video_id: 'vid_100',
      event_id: '',
      stage: 'INVALID_STAGE',
      progress: 150, // invalid progress > 100
    };

    const res = MediaCallbackPayloadSchema.safeParse(invalidPayload);
    expect(res.success).toBe(false);
  });

  it('formats deterministic R2 keys for voice assets', () => {
    const voiceKey = buildR2ObjectKey({
      videoId: 'vid_999',
      sceneId: 'scn_2',
      assetType: 'VOICE',
      assetId: 'ast_voc_456',
      extension: 'mp3',
    });

    expect(voiceKey).toBe(
      'video-factory/users/default/projects/default/videos/vid_999/scenes/scn_2/voice/ast_voc_456.mp3'
    );
  });
});
