import crypto from 'crypto';
import { getEnv } from './env';

/**
 * Constant-time string comparison to prevent timing attacks on callback authentication
 */
export function verifyCallbackSecret(providedSecret: string | null | undefined): boolean {
  if (!providedSecret) {
    return false;
  }

  const expectedSecret = getEnv().VIDEO_FACTORY_N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
