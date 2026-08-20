import { NextRequest, NextResponse } from 'next/server';
import { getMediaAssetById } from '@video-factory/database';
import { createStorageProvider } from '@video-factory/providers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const { id: videoId, assetId } = await params;
    const asset = await getMediaAssetById(assetId);

    if (!asset || asset.videoId !== videoId) {
      return NextResponse.json(
        { success: false, error: 'المادة غير موجودة أو غير مرتبطة بهذا الفيديو' },
        { status: 404 }
      );
    }

    const storage = createStorageProvider(asset.storageProvider);
    const presigned = await storage.getSignedReadUrl(asset.objectKey, 3600, asset.bucket);

    return NextResponse.json({
      success: true,
      data: {
        assetId: asset.id,
        url: presigned.url,
        expiresInSeconds: presigned.expiresInSeconds,
        mimeType: asset.mimeType,
        type: asset.type,
      },
    });
  } catch (error) {
    console.error('[API_GET_PRESIGNED_URL_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'تعذر توليد رابط معاينة المادة' },
      { status: 500 }
    );
  }
}
