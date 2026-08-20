import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '../security/encryption';

describe('AES-256-GCM Token Encryption', () => {
  it('encrypts and decrypts sensitive token strings accurately', () => {
    const plainToken = 'ya29.a0AXooCg_test_oauth_access_token_1234567890';
    const encrypted = encryptToken(plainToken);

    expect(encrypted).not.toBe(plainToken);
    expect(encrypted.startsWith('v1:')).toBe(true);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plainToken);
  });

  it('generates different ciphertexts for the same plaintext due to random IV', () => {
    const plainToken = 'secret_token_abc';
    const enc1 = encryptToken(plainToken);
    const enc2 = encryptToken(plainToken);

    expect(enc1).not.toBe(enc2);
    expect(decryptToken(enc1)).toBe(plainToken);
    expect(decryptToken(enc2)).toBe(plainToken);
  });

  it('handles empty string gracefully', () => {
    expect(encryptToken('')).toBe('');
    expect(decryptToken('')).toBe('');
  });

  it('fails decryption with corrupted payload or auth tag', () => {
    const plain = 'my_secure_token';
    const encrypted = encryptToken(plain);
    const parts = encrypted.split(':');
    // Tamper with encrypted data
    const corrupted = `${parts[0]}:${parts[1]}:${parts[2]}:ffff${parts[3].substring(4)}`;

    expect(() => decryptToken(corrupted)).toThrow();
  });

  it('fails decryption with wrong secret key', () => {
    const plain = 'secret_data';
    const enc = encryptToken(plain, 'custom_secret_key_1');
    expect(() => decryptToken(enc, 'custom_secret_key_2')).toThrow();
  });
});
