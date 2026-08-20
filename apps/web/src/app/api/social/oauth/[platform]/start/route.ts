import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createPublishingProvider } from '@video-factory/providers';
import { SocialPlatformEnum, type SocialPlatform, getPlatformLaunchStatus } from '@video-factory/contracts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  const { platform: rawPlatform } = await params;
  const platformUpper = rawPlatform.toUpperCase();
  const platformResult = SocialPlatformEnum.safeParse(platformUpper);

  if (!platformResult.success) {
    return NextResponse.json({ success: false, error: 'المنصة غير مدعومة' }, { status: 400 });
  }

  const platform = platformResult.data as SocialPlatform;

  // Check launch scope feature flags
  const launchStatus = getPlatformLaunchStatus(platform);
  if (!launchStatus.enabled) {
    return NextResponse.json(
      { success: false, error: launchStatus.reasonDisabled || 'هذه المنصة غير مفعلة في نطاق الإطلاق الحالي' },
      { status: 403 }
    );
  }

  // Rate limit OAuth start requests (max 10 per minute per user)
  const rl = checkRateLimit(`oauth_start_${user.userId}`, { windowMs: 60000, maxRequests: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: 'تم تجاوز عدد محاولات الربط المسموحة، يرجى الانتظار دقيقة' },
      { status: 429 }
    );
  }

  try {
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const redirectUri = `${origin}/api/social/oauth/${platform.toLowerCase()}/callback`;

    // Secure state with HMAC payload
    const nonce = crypto.randomBytes(16).toString('hex');
    const statePayload = JSON.stringify({
      userId: user.userId,
      platform,
      nonce,
      createdAt: Date.now(),
    });
    const state = Buffer.from(statePayload).toString('base64url');

    const provider = createPublishingProvider(platform);
    const authUrl = await provider.getAuthUrl({
      userId: user.userId,
      redirectUri,
      state,
    });

    return NextResponse.json({
      success: true,
      data: {
        platform,
        authUrl,
        redirectUri,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_OAUTH_START_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'تعذر بدء جلسة الربط' },
      { status: 500 }
    );
  }
}
