import crypto from 'crypto';
import {
  isPlaceholderValue,
  isProductionRuntime,
  ProductionConfigError,
} from '@video-factory/contracts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTION_VERSION = 'v1';

const DEV_FALLBACK_SECRET = 'video_factory_default_dev_encryption_secret_key_32_bytes_min!';

/**
 * Derives a 32-byte key from the environment encryption key.
 * In production the SOCIAL_TOKEN_ENCRYPTION_KEY must be real — the embedded
 * development fallback is never acceptable there.
 */
function getEncryptionKey(overrideKey?: string): Buffer {
  const secret = overrideKey || process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (isPlaceholderValue(secret)) {
    if (isProductionRuntime()) {
      throw new ProductionConfigError(
        'SOCIAL_TOKEN_ENCRYPTION_KEY is missing or a placeholder in production; refusing to encrypt/decrypt social tokens with a development key'
      );
    }
    return crypto.createHash('sha256').update(DEV_FALLBACK_SECRET).digest();
  }

  return crypto.createHash('sha256').update(secret as string).digest();
}

/**
 * Encrypts sensitive string (such as OAuth access/refresh token) using AES-256-GCM authenticated encryption
 */
export function encryptToken(plainText: string, secretKey?: string): string {
  if (!plainText) return '';

  const key = getEncryptionKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts sensitive string using AES-256-GCM authenticated encryption
 */
export function decryptToken(cipherText: string, secretKey?: string): string {
  if (!cipherText) return '';

  const parts = cipherText.split(':');
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error('صيغة رمز التشفير غير صالحة أو غير مدعومة');
  }

  const [, ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err: unknown) {
    throw new Error('فشل فك تشفير الرمز السري (مفتاح التشفير غير مطابق أو البيانات تالفة)');
  }
}
