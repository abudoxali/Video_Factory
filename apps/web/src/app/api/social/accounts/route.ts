import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSocialAccounts } from '@video-factory/database';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const accounts = await getSocialAccounts(user.userId);
    // Redact encrypted tokens before returning to UI
    const safeAccounts = accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      platformUserId: acc.platformUserId,
      platformUsername: acc.platformUsername,
      displayName: acc.displayName,
      avatarUrl: acc.avatarUrl,
      status: acc.status,
      scopes: acc.scopes,
      tokenExpiresAt: acc.tokenExpiresAt,
      connectedAt: acc.connectedAt,
      lastRefreshedAt: acc.lastRefreshedAt,
    }));

    return NextResponse.json({
      success: true,
      data: safeAccounts,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_GET_SOCIAL_ACCOUNTS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب الحسابات المتصلة' },
      { status: 500 }
    );
  }
}
