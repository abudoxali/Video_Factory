import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import {
  getVideoPublications,
  getSocialAccountById,
  recordAnalyticsSnapshot,
  getVideoAnalyticsSummary,
} from '@video-factory/database';
import {
  createAnalyticsProvider,
  decryptToken,
} from '@video-factory/providers';
import type { SocialPlatform } from '@video-factory/contracts';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const { id: videoId } = await params;
    const summary = await getVideoAnalyticsSummary(videoId, user.userId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_GET_ANALYTICS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب إحصاءات الفيديو' },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const { id: videoId } = await params;
    const pubs = await getVideoPublications(videoId, user.userId);
    const publishedPubs = pubs.filter(
      (p) => p.status === 'PUBLISHED' && p.platformPublicationId
    );

    const refreshedSnapshots = [];

    for (const pub of publishedPubs) {
      const account = await getSocialAccountById(pub.socialAccountId, user.userId);
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
        platformPublicationId: pub.platformPublicationId!,
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

      refreshedSnapshots.push(saved);
    }

    const updatedSummary = await getVideoAnalyticsSummary(videoId, user.userId);

    return NextResponse.json({
      success: true,
      message: 'تم تحديث إحصاءات المنشورات بنجاح من المنصات',
      data: updatedSummary,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_REFRESH_ANALYTICS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر تحديث إحصاءات الفيديو' },
      { status: 500 }
    );
  }
}
