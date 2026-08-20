import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyCallbackSecret } from '../src/lib/auth-check';

describe('Callback Authentication & Secret Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, VIDEO_FACTORY_N8N_CALLBACK_SECRET: 'test_super_secret_123' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts correct secret matching environment', () => {
    expect(verifyCallbackSecret('test_super_secret_123')).toBe(true);
  });

  it('rejects missing or empty secret', () => {
    expect(verifyCallbackSecret('')).toBe(false);
    expect(verifyCallbackSecret(null)).toBe(false);
    expect(verifyCallbackSecret(undefined)).toBe(false);
  });

  it('rejects incorrect secret', () => {
    expect(verifyCallbackSecret('wrong_secret_value')).toBe(false);
    expect(verifyCallbackSecret('test_super_secret_124')).toBe(false);
  });

  it('rejects secrets with mismatched lengths safely', () => {
    expect(verifyCallbackSecret('short')).toBe(false);
    expect(verifyCallbackSecret('very_long_secret_that_does_not_match_length_at_all')).toBe(false);
  });
});
