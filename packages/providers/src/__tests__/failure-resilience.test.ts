import { describe, it, expect } from 'vitest';
import {
  YouTubePublishingProvider,
  InstagramPublishingProvider,
  TikTokPublishingProvider,
  decryptToken,
  PublishAuthError,
  PublishRateLimitError,
  PublishMediaInvalidError,
} from '../index';

describe('Failure Resilience & Graceful Error Handling', () => {
  it('identifies retryable vs non-retryable publishing errors', () => {
    const authErr = new PublishAuthError();
    expect(authErr.isRetryable).toBe(false);
    expect(authErr.code).toBe('PUBLISH_AUTH_REQUIRED');

    const rateLimitErr = new PublishRateLimitError();
    expect(rateLimitErr.isRetryable).toBe(true);
    expect(rateLimitErr.code).toBe('PUBLISH_RATE_LIMIT');

    const mediaErr = new PublishMediaInvalidError('Invalid aspect ratio');
    expect(mediaErr.isRetryable).toBe(false);
    expect(mediaErr.code).toBe('PUBLISH_INVALID_MEDIA');
  });

  it('rejects invalid YouTube duration without throwing uncaught exceptions', async () => {
    const yt = new YouTubePublishingProvider({ clientId: 'mock', clientSecret: 'mock' });
    const result = await yt.publish({
      publicationId: 'pub_test',
      videoId: 'vid_test',
      renderId: 'rnd_test',
      userId: 'usr_test',
      account: { id: 'acc_1', platformUserId: 'p_1', accessToken: 'invalid_token' },
      metadata: { title: 'Test', caption: 'Test', description: 'Test', tags: [], hashtags: [], privacy: 'private' },
      video: {
        r2ObjectKey: 'test.mp4',
        sizeBytes: 1000,
        durationSeconds: 0, // Invalid duration
        width: 1080,
        height: 1920,
        mimeType: 'video/mp4',
      },
      idempotencyKey: 'key_1',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PUBLISH_INVALID_MEDIA');
  });

  it('rejects invalid Instagram Reels duration without throwing uncaught exceptions', async () => {
    const ig = new InstagramPublishingProvider({ appId: 'mock', appSecret: 'mock' });
    const result = await ig.publish({
      publicationId: 'pub_test',
      videoId: 'vid_test',
      renderId: 'rnd_test',
      userId: 'usr_test',
      account: { id: 'acc_1', platformUserId: 'p_1', accessToken: 'invalid_token' },
      metadata: { title: 'Test', caption: 'Test', description: 'Test', tags: [], hashtags: [], privacy: 'private' },
      video: {
        r2ObjectKey: 'test.mp4',
        sizeBytes: 1000,
        durationSeconds: 1500, // 25 mins (exceeds 15 min Reels max)
        width: 1080,
        height: 1920,
        mimeType: 'video/mp4',
      },
      idempotencyKey: 'key_2',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PUBLISH_INVALID_MEDIA');
  });

  it('rejects invalid TikTok video without throwing uncaught exceptions', async () => {
    const tt = new TikTokPublishingProvider({ clientKey: 'mock', clientSecret: 'mock' });
    const result = await tt.publish({
      publicationId: 'pub_test',
      videoId: 'vid_test',
      renderId: 'rnd_test',
      userId: 'usr_test',
      account: { id: 'acc_1', platformUserId: 'p_1', accessToken: 'invalid_token' },
      metadata: { title: 'Test', caption: 'Test', description: 'Test', tags: [], hashtags: [], privacy: 'private' },
      video: {
        r2ObjectKey: 'test.mp4',
        sizeBytes: 1000,
        durationSeconds: 1, // Under 3s minimum
        width: 1080,
        height: 1920,
        mimeType: 'video/mp4',
      },
      idempotencyKey: 'key_3',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('PUBLISH_INVALID_MEDIA');
  });

  it('rejects tampered encrypted tokens securely', () => {
    expect(() => decryptToken('v1:bad_iv:bad_tag:bad_cipher')).toThrow();
  });
});
