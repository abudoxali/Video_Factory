import { describe, it, expect } from 'vitest';
import {
  YouTubePublishingProvider,
  InstagramPublishingProvider,
  TikTokPublishingProvider,
  MockPublishingProvider,
  createPublishingProvider,
} from '../publishing';

describe('Social Publishing Providers', () => {
  describe('YouTube Provider', () => {
    const provider = new YouTubePublishingProvider({
      clientId: 'mock_client_id',
      clientSecret: 'mock_client_secret',
    });

    it('returns accurate YouTube platform capabilities', () => {
      const caps = provider.getCapabilities();
      expect(caps.platform).toBe('YOUTUBE');
      expect(caps.supportsScheduling).toBe(true);
      expect(caps.maxDurationSeconds).toBeGreaterThan(3600);
    });

    it('generates valid Google OAuth authorization URL', async () => {
      const authUrl = await provider.getAuthUrl({
        userId: 'usr_test',
        redirectUri: 'http://localhost:3000/api/social/oauth/youtube/callback',
        state: 'secure_state_123',
      });

      expect(authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain('client_id=mock_client_id');
      expect(authUrl).toContain('state=secure_state_123');
    });

    it('validates video duration and constraints', async () => {
      const valid = await provider.validateMedia({
        sizeBytes: 10 * 1024 * 1024,
        durationSeconds: 60,
        width: 1080,
        height: 1920,
        fps: 30,
        mimeType: 'video/mp4',
        aspectRatio: '9:16',
      });

      expect(valid.valid).toBe(true);

      const invalid = await provider.validateMedia({
        sizeBytes: 10 * 1024 * 1024,
        durationSeconds: 0, // Less than minimum
        width: 1080,
        height: 1920,
        fps: 30,
        mimeType: 'video/mp4',
        aspectRatio: '9:16',
      });

      expect(invalid.valid).toBe(false);
      expect(invalid.errorCode).toBe('PUBLISH_INVALID_MEDIA');
    });
  });

  describe('Instagram Provider', () => {
    const provider = new InstagramPublishingProvider({
      appId: 'mock_meta_app_id',
      appSecret: 'mock_meta_app_secret',
    });

    it('returns accurate Instagram Reels platform capabilities', () => {
      const caps = provider.getCapabilities();
      expect(caps.platform).toBe('INSTAGRAM');
      expect(caps.requiresBusinessAccount).toBe(true);
      expect(caps.maxDurationSeconds).toBe(900); // 15 mins for Reels
    });

    it('generates valid Meta OAuth authorization URL', async () => {
      const authUrl = await provider.getAuthUrl({
        userId: 'usr_test',
        redirectUri: 'http://localhost:3000/api/social/oauth/instagram/callback',
        state: 'secure_state_meta',
      });

      expect(authUrl).toContain('facebook.com/v22.0/dialog/oauth');
      expect(authUrl).toContain('client_id=mock_meta_app_id');
      expect(authUrl).toContain('state=secure_state_meta');
    });

    it('validates Reels duration limits', async () => {
      const tooLong = await provider.validateMedia({
        sizeBytes: 50 * 1024 * 1024,
        durationSeconds: 1200, // 20 mins (exceeds 15 min limit)
        width: 1080,
        height: 1920,
        fps: 30,
        mimeType: 'video/mp4',
        aspectRatio: '9:16',
      });

      expect(tooLong.valid).toBe(false);
      expect(tooLong.errorCode).toBe('PUBLISH_INVALID_MEDIA');
    });
  });

  describe('TikTok Provider', () => {
    const provider = new TikTokPublishingProvider({
      clientKey: 'mock_tt_client_key',
      clientSecret: 'mock_tt_client_secret',
    });

    it('returns accurate TikTok platform capabilities', () => {
      const caps = provider.getCapabilities();
      expect(caps.platform).toBe('TIKTOK');
      expect(caps.maxDurationSeconds).toBe(600); // 10 mins
    });

    it('generates valid TikTok OAuth authorization URL with PKCE', async () => {
      const authUrl = await provider.getAuthUrl({
        userId: 'usr_test',
        redirectUri: 'http://localhost:3000/api/social/oauth/tiktok/callback',
        state: 'secure_state_tiktok',
        codeChallenge: 'mock_code_challenge_hash',
      });

      expect(authUrl).toContain('tiktok.com/v2/auth/authorize/');
      expect(authUrl).toContain('client_key=mock_tt_client_key');
      expect(authUrl).toContain('code_challenge=mock_code_challenge_hash');
    });
  });

  describe('Mock Publishing Provider & Factory', () => {
    it('successfully runs mock publish pipeline for all platforms', async () => {
      const platforms = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] as const;

      for (const plt of platforms) {
        const mockProvider = createPublishingProvider(plt, { forceMock: true });
        expect(mockProvider.platform).toBe(plt);

        const result = await mockProvider.publish({
          publicationId: `pub_${plt.toLowerCase()}_123`,
          videoId: 'vid_test',
          renderId: 'rnd_test',
          userId: 'usr_test',
          account: {
            id: 'acc_123',
            platformUserId: 'plt_usr_123',
            accessToken: 'mock_access_token',
          },
          metadata: {
            title: 'فيديو تجريبي',
            caption: 'كابشن تجريبي',
            description: 'وصف تجريبي',
            tags: ['فيديو'],
            hashtags: ['#فيديو'],
            privacy: 'public',
          },
          video: {
            r2ObjectKey: 'renders/test.mp4',
            sizeBytes: 5000000,
            durationSeconds: 15,
            width: 1080,
            height: 1920,
            mimeType: 'video/mp4',
          },
          idempotencyKey: 'idemp_key_123',
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('PUBLISHED');
        expect(result.platformUrl).toBeDefined();
      }
    });
  });
});
