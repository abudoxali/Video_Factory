import { describe, it, expect } from 'vitest';
import {
  YouTubeAnalyticsProvider,
  InstagramInsightsProvider,
  TikTokAnalyticsProvider,
  MockAnalyticsProvider,
  createAnalyticsProvider,
} from '../analytics';

describe('Social Analytics Providers', () => {
  it('instantiates analytics providers correctly via factory', () => {
    const yt = createAnalyticsProvider('YOUTUBE', { forceMock: true });
    const ig = createAnalyticsProvider('INSTAGRAM', { forceMock: true });
    const tt = createAnalyticsProvider('TIKTOK', { forceMock: true });

    expect(yt.platform).toBe('YOUTUBE');
    expect(ig.platform).toBe('INSTAGRAM');
    expect(tt.platform).toBe('TIKTOK');
  });

  it('fetches normalized analytics snapshot via mock analytics provider', async () => {
    const mock = new MockAnalyticsProvider('YOUTUBE');
    const snapshot = await mock.fetchPublicationAnalytics({
      publicationId: 'pub_test_123',
      platform: 'YOUTUBE',
      platformPublicationId: 'yt_vid_123',
      account: { accessToken: 'mock_token' },
    });

    expect(snapshot.publicationId).toBe('pub_test_123');
    expect(snapshot.platform).toBe('YOUTUBE');
    expect(snapshot.views).toBeGreaterThan(0);
    expect(snapshot.likes).toBeGreaterThan(0);
    expect(snapshot.capturedAt).toBeInstanceOf(Date);
  });
});
