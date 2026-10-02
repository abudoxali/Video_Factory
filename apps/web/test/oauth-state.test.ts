import crypto from 'crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { createOAuthState, verifyOAuthState } from '../src/lib/oauth-state';

const DEV_STATE_SECRET = 'vf_dev_oauth_state_secret_not_for_production';

function signManually(encoded: string, secret = DEV_STATE_SECRET): string {
  return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}

function craftState(payload: Record<string, unknown>, secret = DEV_STATE_SECRET): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signManually(encoded, secret)}`;
}

const VALID_PAYLOAD = {
  userId: 'usr_test_1',
  platform: 'YOUTUBE',
  redirectUri: 'http://localhost:3000/api/social/oauth/youtube/callback',
  nonce: 'abc123abc123abc123abc123',
  createdAt: Date.now(),
};

describe('OAuth state authentication (server-signed)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips a valid signed state', () => {
    const state = createOAuthState({
      userId: 'usr_test_1',
      platform: 'YOUTUBE',
      redirectUri: 'http://localhost:3000/api/social/oauth/youtube/callback',
    });
    const res = verifyOAuthState(state, 'YOUTUBE');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.userId).toBe('usr_test_1');
      expect(res.payload.platform).toBe('YOUTUBE');
    }
  });

  it('rejects a merely base64url-decodable state with no signature', () => {
    const bare = Buffer.from(JSON.stringify(VALID_PAYLOAD)).toString('base64url');
    const res = verifyOAuthState(bare, 'YOUTUBE');
    expect(res.ok).toBe(false);
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const state = createOAuthState({
      userId: 'usr_victim',
      platform: 'YOUTUBE',
      redirectUri: 'http://localhost:3000/api/social/oauth/youtube/callback',
    });
    const [, sig] = state.split('.');
    // Attacker swaps the userId but keeps the original signature
    const forged = Buffer.from(
      JSON.stringify({ ...VALID_PAYLOAD, userId: 'usr_attacker' })
    ).toString('base64url');
    const res = verifyOAuthState(`${forged}.${sig}`, 'YOUTUBE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_state_signature');
  });

  it('rejects state signed with the wrong secret', () => {
    const res = verifyOAuthState(craftState(VALID_PAYLOAD, 'wrong_secret'), 'YOUTUBE');
    expect(res.ok).toBe(false);
  });

  it('rejects state bound to a different platform', () => {
    const state = craftState({ ...VALID_PAYLOAD, platform: 'TIKTOK' });
    const res = verifyOAuthState(state, 'YOUTUBE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('platform_mismatch');
  });

  it('rejects expired state (older than 15 minutes)', () => {
    const state = craftState({ ...VALID_PAYLOAD, createdAt: Date.now() - 16 * 60 * 1000 });
    const res = verifyOAuthState(state, 'YOUTUBE');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('expired_state');
  });

  it('rejects malformed and empty states', () => {
    expect(verifyOAuthState('', 'YOUTUBE').ok).toBe(false);
    expect(verifyOAuthState(null, 'YOUTUBE').ok).toBe(false);
    expect(verifyOAuthState('not-a-state', 'YOUTUBE').ok).toBe(false);
    expect(verifyOAuthState('a.b.c', 'YOUTUBE').ok).toBe(false);
  });
});
