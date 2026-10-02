import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateDefaultUser } from '@video-factory/database';
import {
  isPlaceholderValue,
  isProductionRuntime,
} from '@video-factory/contracts';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  isDevBypass?: boolean;
}

const SESSION_COOKIE_NAME = 'vf_session_user_id';
const USER_ID_PATTERN = /^usr_[A-Za-z0-9_-]{1,128}$/;
const DEV_SESSION_SECRET = 'vf_dev_session_secret_not_for_production';

/**
 * Resolves the server-side signing secret for session cookies.
 * Returns undefined in production when no real secret is configured —
 * unsigned or unsignable sessions are then never trusted.
 */
function getSessionSecret(): string | undefined {
  const secret = process.env.VIDEO_FACTORY_SESSION_SECRET;
  if (isPlaceholderValue(secret)) {
    return isProductionRuntime() ? undefined : DEV_SESSION_SECRET;
  }
  return secret;
}

/**
 * Produces a signed session cookie value: `<userId>.<hmac-sha256>`.
 * Used by session-issuing code; the signature binds the userId to a
 * server-held secret so clients cannot forge identities.
 */
export function signSessionValue(userId: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('VIDEO_FACTORY_SESSION_SECRET is not configured');
  }
  const signature = crypto.createHmac('sha256', secret).update(userId).digest('base64url');
  return `${userId}.${signature}`;
}

/**
 * Verifies a session cookie value and returns the embedded userId, or null.
 * In development/test a legacy unsigned `usr_*` value is still accepted so
 * existing flows keep working; in production only signed values pass.
 */
export function verifySessionValue(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const dotIdx = raw.lastIndexOf('.');
  if (dotIdx > 0) {
    const userId = raw.slice(0, dotIdx);
    const signature = raw.slice(dotIdx + 1);
    const secret = getSessionSecret();
    if (!secret) return null;

    const expected = crypto.createHmac('sha256', secret).update(userId).digest('base64url');
    const providedBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return USER_ID_PATTERN.test(userId) ? userId : null;
    }
    return null;
  }

  // Unsigned value — only trusted outside production.
  if (isProductionRuntime()) return null;
  return USER_ID_PATTERN.test(raw) ? raw : null;
}

/**
 * Resolves current authenticated user session with production boundary
 */
export async function getAuthenticatedUser(
  request?: NextRequest
): Promise<AuthenticatedUser | null> {
  // 1. Check session cookie
  let rawCookieValue: string | undefined;

  try {
    const cookieStore = await cookies();
    rawCookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // If called outside Next request context
  }

  if (!rawCookieValue && request) {
    rawCookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  const userIdFromCookie = verifySessionValue(rawCookieValue);
  if (userIdFromCookie) {
    return {
      userId: userIdFromCookie,
      email: `${userIdFromCookie}@videofactory.local`,
      name: 'User',
    };
  }

  // 2. Bearer `usr_*` shortcut — API testing/internal convenience ONLY.
  //    Never honored in production: an arbitrary bearer user id is not an
  //    authenticated identity.
  if (request && !isProductionRuntime()) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer usr_')) {
      const bearerUserId = authHeader.replace('Bearer ', '').trim();
      if (USER_ID_PATTERN.test(bearerUserId)) {
        return {
          userId: bearerUserId,
          email: `${bearerUserId}@videofactory.local`,
          name: 'User',
          isDevBypass: true,
        };
      }
    }
  }

  // 3. Development fallback (ONLY allowed in non-production environments)
  if (!isProductionRuntime()) {
    const devUser = await getOrCreateDefaultUser();
    return {
      userId: devUser.id,
      email: devUser.email,
      name: devUser.name || 'مستخدم تجريبي',
      isDevBypass: true,
    };
  }

  return null;
}
