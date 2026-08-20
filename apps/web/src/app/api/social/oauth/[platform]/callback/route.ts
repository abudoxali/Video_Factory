import { NextRequest, NextResponse } from 'next/server';
import { createPublishingProvider, encryptToken } from '@video-factory/providers';
import { saveSocialAccountTransaction } from '@video-factory/database';
import { SocialPlatformEnum, type SocialPlatform } from '@video-factory/contracts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: rawPlatform } = await params;
  const platformUpper = rawPlatform.toUpperCase();
  const platformResult = SocialPlatformEnum.safeParse(platformUpper);

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error') || searchParams.get('error_description');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/settings/social?status=error&message=${encodeURIComponent(errorParam)}`, request.nextUrl.origin)
    );
  }

  if (!platformResult.success || !code || !state) {
    return NextResponse.redirect(
      new URL('/settings/social?status=error&message=بيانات_التحقق_غير_صالحة', request.nextUrl.origin)
    );
  }

  const platform = platformResult.data as SocialPlatform;

  try {
    // 1. Decode and Validate State
    const stateJson = Buffer.from(state, 'base64url').toString('utf8');
    const statePayload = JSON.parse(stateJson);

    // Verify age (max 15 minutes)
    if (Date.now() - statePayload.createdAt > 15 * 60 * 1000) {
      return NextResponse.redirect(
        new URL('/settings/social?status=error&message=انتهت_مهلة_جلسة_الربط', request.nextUrl.origin)
      );
    }

    const userId = statePayload.userId;
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const redirectUri = `${origin}/api/social/oauth/${platform.toLowerCase()}/callback`;

    // 2. Exchange Code for Tokens Server-Side
    const provider = createPublishingProvider(platform);
    const tokenResponse = await provider.exchangeCodeForTokens(code, redirectUri);

    // 3. Encrypt Tokens with Authenticated AES-256-GCM
    const accessTokenEncrypted = encryptToken(tokenResponse.accessToken);
    const refreshTokenEncrypted = tokenResponse.refreshToken
      ? encryptToken(tokenResponse.refreshToken)
      : null;

    const tokenExpiresAt = tokenResponse.expiresInSeconds
      ? new Date(Date.now() + tokenResponse.expiresInSeconds * 1000)
      : null;

    const refreshExpiresAt = tokenResponse.refreshExpiresInSeconds
      ? new Date(Date.now() + tokenResponse.refreshExpiresInSeconds * 1000)
      : null;

    // 4. Persist Account in Database
    await saveSocialAccountTransaction({
      userId,
      platform,
      platformUserId: tokenResponse.platformUserId,
      platformUsername: tokenResponse.platformUsername,
      displayName: tokenResponse.displayName,
      avatarUrl: tokenResponse.avatarUrl,
      scopes: tokenResponse.scopes,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      refreshExpiresAt,
      metadata: tokenResponse.rawResponse || null,
    });

    // 5. Redirect Safely without exposing any tokens in URL
    return NextResponse.redirect(
      new URL(`/settings/social?status=connected&platform=${platform.toLowerCase()}`, request.nextUrl.origin)
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_OAUTH_CALLBACK_ERROR]', err);
    return NextResponse.redirect(
      new URL(`/settings/social?status=error&message=${encodeURIComponent(err.message || 'فشل إتمام ربط الحساب')}`, request.nextUrl.origin)
    );
  }
}
