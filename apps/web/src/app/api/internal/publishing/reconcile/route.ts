import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import {
  getPendingPublicationsToReconcile,
  getSocialAccountById,
  updatePublicationStatusTransaction,
} from '@video-factory/database';
import { createPublishingProvider, decryptToken } from '@video-factory/providers';
import type { SocialPlatform } from '@video-factory/contracts';

export async function GET(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const pendingPubs = await getPendingPublicationsToReconcile();
    const reconciled = [];

    for (const pub of pendingPubs) {
      if (!pub.platformPublicationId) continue;
      const account = await getSocialAccountById(pub.socialAccountId);
      if (!account || account.status !== 'CONNECTED') continue;

      let accessToken = '';
      try {
        accessToken = decryptToken(account.accessTokenEncrypted);
      } catch {
        continue;
      }

      const provider = createPublishingProvider(pub.platform as SocialPlatform);
      const statusResult = await provider.getStatus({
        publicationId: pub.id,
        platformPublicationId: pub.platformPublicationId,
        account: { accessToken },
        metadata: (pub.metadataJson as any) || undefined,
      });

      if (statusResult.status !== pub.status) {
        await updatePublicationStatusTransaction(
          pub.id,
          {
            status: statusResult.status,
            platformUrl: statusResult.platformUrl,
          },
          {
            errorCode: statusResult.errorCode,
            errorMessage: statusResult.errorMessage,
          }
        );

        reconciled.push({
          id: pub.id,
          platform: pub.platform,
          previousStatus: pub.status,
          newStatus: statusResult.status,
        });
      }
    }

    return NextResponse.json({
      success: true,
      reconciledCount: reconciled.length,
      reconciled,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_RECONCILE_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر تشغيل عملية مطابقة المنشورات' },
      { status: 500 }
    );
  }
}
