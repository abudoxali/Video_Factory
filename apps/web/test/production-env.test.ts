import { describe, it, expect, afterEach } from 'vitest';
import { getEnv, resetEnvCacheForTests, assertWebProductionEnv } from '../src/lib/env';
import { ProductionConfigError, validateProductionEnvironment } from '@video-factory/contracts';

/**
 * Production environment gate: production must fail closed — never silently
 * fall back to dev defaults, localhost endpoints, or placeholder secrets.
 */
describe('Production environment validation boundary', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCacheForTests();
  });

  function setProd(overrides: Record<string, string | undefined> = {}) {
    process.env = { ...originalEnv, ...overrides };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.NEXT_PHASE;
    resetEnvCacheForTests();
  }

  const FULL_PROD_ENV: Record<string, string> = {
    DATABASE_URL: 'postgres://vf:secret@db.internal:5432/video_factory',
    N8N_VIDEO_FACTORY_WEBHOOK_URL: 'https://n8n.internal.vf-corp.io/webhook/vf-job-orchestrator',
    N8N_VIDEO_FACTORY_WEBHOOK_SECRET: 'real_webhook_secret_value_12345',
    VIDEO_FACTORY_N8N_CALLBACK_SECRET: 'real_callback_secret_value_67890',
    VIDEO_FACTORY_SESSION_SECRET: 'real_session_secret_value_abcdef',
    SOCIAL_TOKEN_ENCRYPTION_KEY: 'real_encryption_key_value_32_bytes!!',
    NEXT_PUBLIC_APP_URL: 'https://app.videofactory.io',
    R2_ACCOUNT_ID: 'cf_account_123',
    R2_ACCESS_KEY_ID: 'r2ak_real',
    R2_SECRET_ACCESS_KEY: 'r2sk_real',
    R2_BUCKET_NAME: 'vf-media-prod',
    GEMINI_API_KEY: 'gemini_real_key',
    ELEVENLABS_API_KEY: 'elevenlabs_real_key',
    GOOGLE_OAUTH_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
    META_APP_ID: 'meta_app_id_1',
    META_APP_SECRET: 'meta_app_secret_1',
    TIKTOK_CLIENT_KEY: 'tiktok_client_key_1',
    TIKTOK_CLIENT_SECRET: 'tiktok_client_secret_1',
  };

  it('throws in production when required variables are missing entirely', () => {
    setProd();
    expect(() => getEnv()).toThrow(ProductionConfigError);
    expect(() => getEnv()).toThrow(/DATABASE_URL|missing or a placeholder/);
  });

  it('rejects placeholder secrets in production', () => {
    setProd({ ...FULL_PROD_ENV, VIDEO_FACTORY_SESSION_SECRET: 'your_session_secret_here' });
    expect(() => getEnv()).toThrow(/VIDEO_FACTORY_SESSION_SECRET/);
  });

  it('rejects localhost webhook URLs in production', () => {
    setProd({ ...FULL_PROD_ENV, N8N_VIDEO_FACTORY_WEBHOOK_URL: 'http://localhost:5678/webhook/x' });
    expect(() => getEnv()).toThrow(/N8N_VIDEO_FACTORY_WEBHOOK_URL/);
  });

  it('rejects localhost public app URL in production', () => {
    setProd({ ...FULL_PROD_ENV, NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('accepts a complete real production configuration', () => {
    setProd(FULL_PROD_ENV);
    const env = getEnv();
    expect(env.DATABASE_URL).toBe(FULL_PROD_ENV.DATABASE_URL);
    expect(env.NODE_ENV).toBe('production');
  });

  it('applies safe localhost defaults in development', () => {
    process.env = { ...originalEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.DATABASE_URL).toContain('localhost');
  });

  it('platform validation reports every missing variable', () => {
    setProd({ ENABLE_YOUTUBE: 'true', ENABLE_INSTAGRAM: 'true', ENABLE_TIKTOK: 'true' });
    try {
      validateProductionEnvironment('test-suite');
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as ProductionConfigError;
      expect(e.missing).toContain('DATABASE_URL');
      expect(e.missing).toContain('R2_SECRET_ACCESS_KEY');
      expect(e.missing).toContain('GEMINI_API_KEY');
      expect(e.missing).toContain('GOOGLE_OAUTH_CLIENT_SECRET');
      expect(e.missing).toContain('TIKTOK_CLIENT_SECRET');
      expect(e.missing).toContain('SOCIAL_TOKEN_ENCRYPTION_KEY');
    }
  });

  it('platform validation is a no-op outside production runtime', () => {
    process.env = { ...originalEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const res = validateProductionEnvironment('test-suite');
    expect(res.ok).toBe(true);
  });

  it('startup assertion passes with complete production config', () => {
    setProd(FULL_PROD_ENV);
    expect(() => assertWebProductionEnv()).not.toThrow();
  });
});
