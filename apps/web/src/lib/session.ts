import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateDefaultUser } from '@video-factory/database';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  isDevBypass?: boolean;
}

const SESSION_COOKIE_NAME = 'vf_session_user_id';

/**
 * Resolves current authenticated user session with production boundary
 */
export async function getAuthenticatedUser(
  request?: NextRequest
): Promise<AuthenticatedUser | null> {
  // 1. Check session cookie
  let userIdFromCookie: string | undefined;

  try {
    const cookieStore = await cookies();
    userIdFromCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // If called outside Next request context
  }

  if (!userIdFromCookie && request) {
    userIdFromCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  // 2. Check authorization header if bearer passed (for API testing / internal services)
  if (!userIdFromCookie && request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer usr_')) {
      userIdFromCookie = authHeader.replace('Bearer ', '').trim();
    }
  }

  if (userIdFromCookie) {
    return {
      userId: userIdFromCookie,
      email: `${userIdFromCookie}@videofactory.local`,
      name: 'User',
    };
  }

  // 3. Development fallback (ONLY allowed in non-production environments)
  if (process.env.NODE_ENV !== 'production') {
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
