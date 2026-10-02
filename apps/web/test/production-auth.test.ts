import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getAuthenticatedUser,
  signSessionValue,
  verifySessionValue,
} from '../src/lib/session';

function reqWith(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('Production Authentication & Session Boundaries', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
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

  it('rejects an arbitrary Bearer usr_* identity in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const req = reqWith({ authorization: 'Bearer usr_attacker' });
    const user = await getAuthenticatedUser(req);
    expect(user).toBeNull();
  });

  it('accepts Bearer usr_* only outside production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    const req = reqWith({ authorization: 'Bearer usr_local_tester' });
    const user = await getAuthenticatedUser(req);
    expect(user?.userId).toBe('usr_local_tester');
  });

  it('rejects an unsigned session cookie in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VIDEO_FACTORY_SESSION_SECRET = 'prod_session_secret_abc123';
    const req = reqWith({ cookie: 'vf_session_user_id=usr_attacker' });
    const user = await getAuthenticatedUser(req);
    expect(user).toBeNull();
  });

  it('accepts a correctly signed session cookie in production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VIDEO_FACTORY_SESSION_SECRET = 'prod_session_secret_abc123';
    const signed = signSessionValue('usr_real_user');
    const req = reqWith({ cookie: `vf_session_user_id=${signed}` });
    const user = await getAuthenticatedUser(req);
    expect(user?.userId).toBe('usr_real_user');
  });

  it('rejects a session cookie signed with a different secret', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VIDEO_FACTORY_SESSION_SECRET = 'prod_session_secret_abc123';
    // Forge a value signed with a wrong key
    const forged = `usr_evil.${Buffer.from('fakesigfakesigfakesigfakesigfakesigfake12').toString('base64url')}`;
    expect(verifySessionValue(forged)).toBeNull();
  });

  it('rejects malformed session values safely', () => {
    expect(verifySessionValue(undefined)).toBeNull();
    expect(verifySessionValue('')).toBeNull();
    expect(verifySessionValue('not_a_user_id')).toBeNull();
    expect(verifySessionValue('usr_x.badsig.extra')).toBeNull();
  });
});
