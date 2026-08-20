import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import {
  getPublishedPublications,
  getSocialAccountById,
  recordAnalyticsSnapshot,
} from '@video-factory/database';
import { createAnalyticsProvider, decryptToken } from '@video-factory/providers';
import type { SocialPlatform } from '@video-factory/contracts';

export async function GET(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const publishedList = await getPublishedPublications(50);
    const synced = [];

    for (const pub of publishedList) {
      if (!pub.platformPublicationId) continue;
      const account = await getSocialAccountById(pub.socialAccountId);
      if (!account || account.status !== 'CONNECTED') continue;

      let accessToken = '';
      try {
        accessToken = decryptToken(account.accessTokenEncrypted);
      } catch {
        continue;
      }

      const provider = createAnalyticsProvider(pub.platform as SocialPlatform);
      const snapshot = await provider.fetchPublicationAnalytics({
        publicationId: pub.id,
        platform: pub.platform as SocialPlatform,
        platformPublicationId: pub.platformPublicationId,
        account: {
          accessToken,
          platformUserId: account.platformUserId,
        },
      });

      const saved = await recordAnalyticsSnapshot({
        publicationId: pub.id,
        platform: pub.platform as SocialPlatform,
        views: snapshot.views,
        likes: snapshot.likes,
        comments: snapshot.comments,
        shares: snapshot.shares,
        watchTimeSeconds: snapshot.watchTimeSeconds ? String(snapshot.watchTimeSeconds) : null,
        averageViewDurationSeconds: snapshot.averageViewDurationSeconds
          ? String(snapshot.averageViewDurationSeconds)
          : null,
        followersGained: snapshot.followersGained,
        rawSupportedMetrics: snapshot.rawSupportedMetrics,
      });

      synced.push({
        publicationId: pub.id,
        platform: pub.platform,
        views: saved.views,
        likes: saved.likes,
      });
    }

    return NextResponse.json({
      success: true,
      syncedCount: synced.length,
      synced,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_ANALYTICS_SYNC_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر تشغيل عملية مزامنة الإحصاءات' },
      { status: 500 }
    );
  }
}
