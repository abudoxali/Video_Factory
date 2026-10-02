import crypto from 'crypto';
import {
  OAuthStatePayloadSchema,
  isPlaceholderValue,
  isProductionRuntime,
  ProductionConfigError,
  type OAuthStatePayload,
  type SocialPlatform,
} from '@video-factory/contracts';

/**
 * Server-authenticated OAuth state.
 *
 * State is base64url(payload).base64url(HMAC-SHA256(payload)) and is verified
 * on callback with a constant-time signature check, schema validation, age
 * bound, and platform binding. A merely base64url-decodable state is no
 * longer sufficient to be trusted.
 */

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const DEV_STATE_SECRET = 'vf_dev_oauth_state_secret_not_for_production';

function getStateSecret(): string {
  const secret =
    process.env.OAUTH_STATE_SECRET ||
    process.env.VIDEO_FACTORY_SESSION_SECRET ||
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

  if (isPlaceholderValue(secret)) {
    if (isProductionRuntime()) {
      throw new ProductionConfigError(
        'No OAuth state signing secret configured (OAUTH_STATE_SECRET / VIDEO_FACTORY_SESSION_SECRET / SOCIAL_TOKEN_ENCRYPTION_KEY)'
      );
    }
    return DEV_STATE_SECRET;
  }
  return secret as string;
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export interface OAuthStateInput {
  userId: string;
  platform: SocialPlatform;
  redirectUri: string;
  codeVerifier?: string;
}

export function createOAuthState(input: OAuthStateInput): string {
  const payload = OAuthStatePayloadSchema.parse({
    userId: input.userId,
    platform: input.platform,
    redirectUri: input.redirectUri,
    nonce: crypto.randomBytes(16).toString('hex'),
    codeVerifier: input.codeVerifier,
    createdAt: Date.now(),
  });

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signPayload(encoded)}`;
}

export type OAuthStateVerification =
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; error: string };

export function verifyOAuthState(
  state: string | null | undefined,
  expectedPlatform?: SocialPlatform
): OAuthStateVerification {
  if (!state || typeof state !== 'string') {
    return { ok: false, error: 'missing_state' };
  }

  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: 'malformed_state' };
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload);

  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { ok: false, error: 'invalid_state_signature' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'malformed_state_payload' };
  }

  const validated = OAuthStatePayloadSchema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, error: 'invalid_state_payload' };
  }

  const payload = validated.data;

  if (Date.now() - payload.createdAt > STATE_MAX_AGE_MS || payload.createdAt > Date.now() + 60000) {
    return { ok: false, error: 'expired_state' };
  }

  if (expectedPlatform && payload.platform !== expectedPlatform) {
    return { ok: false, error: 'platform_mismatch' };
  }

  return { ok: true, payload };
}
