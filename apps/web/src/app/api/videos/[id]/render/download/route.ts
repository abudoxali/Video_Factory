import { NextRequest, NextResponse } from 'next/server';
import { getActiveVideoRender } from '@video-factory/database';
import { createStorageProvider } from '@video-factory/providers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const activeRender = await getActiveVideoRender(videoId);

    if (!activeRender || !activeRender.objectKey) {
      return NextResponse.json(
        { success: false, error: 'لا يوجد فيديو مكتمل متاح للتحميل' },
        { status: 404 }
      );
    }

    const storage = createStorageProvider(activeRender.storageProvider || 'r2');
    const presigned = await storage.getSignedReadUrl(
      activeRender.objectKey,
      3600,
      activeRender.bucket || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        renderId: activeRender.id,
        version: activeRender.version,
        downloadUrl: presigned.url,
        expiresInSeconds: presigned.expiresInSeconds,
        sizeBytes: activeRender.sizeBytes,
        durationSeconds: activeRender.durationSeconds,
        checksum: activeRender.checksum,
        filename: `video-${videoId}-v${activeRender.version}.mp4`,
      },
    });
  } catch (error) {
    console.error('[API_GET_RENDER_DOWNLOAD_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'تعذر توليد رابط تحميل الفيديو' },
      { status: 500 }
    );
  }
}
