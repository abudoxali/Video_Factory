import { describe, it, expect, afterEach } from 'vitest';
import { getAuthenticatedUser } from '../src/lib/session';

describe('Production Authentication & Session Boundaries', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('rejects unauthenticated access in production mode without dev bypass', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it('allows dev fallback ONLY when NODE_ENV is development or test', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
    expect(user?.userId).toBeDefined();
    expect(user?.isDevBypass).toBe(true);
  });
});
