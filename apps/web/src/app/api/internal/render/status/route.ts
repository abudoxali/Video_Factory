import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { getActiveVideoRender, getRenderById } from '@video-factory/database';
import { createStorageProvider } from '@video-factory/providers';

/**
 * GET /api/internal/render/status?render_id=… | video_id=…&verify_storage=1
 *
 * Read-only truthful render audit for VF-10 / VF-11. Reports the persisted
 * render record and, with verify_storage=1, proves the object physically exists
 * in storage via head(). A render is only `verified` when it is READY with a
 * real persisted MP4 (objectKey + sizeBytes + checksum).
 */
export async function GET(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const renderId = request.nextUrl.searchParams.get('render_id');
    const videoId = request.nextUrl.searchParams.get('video_id');
    const verifyStorage = request.nextUrl.searchParams.get('verify_storage') === '1';

    if (!renderId && !videoId) {
      return NextResponse.json(
        { success: false, error: 'render_id أو video_id مطلوب' },
        { status: 400 }
      );
    }

    const render = renderId
      ? await getRenderById(renderId)
      : await getActiveVideoRender(videoId!);

    if (!render) {
      return NextResponse.json(
        { success: false, error: 'سجل الإخراج غير موجود', data: { verified: false } },
        { status: 404 }
      );
    }

    // Prove the stored object really exists before claiming verified.
    let storageVerified: boolean | null = null;
    if (verifyStorage && render.objectKey) {
      try {
        const storage = createStorageProvider(render.storageProvider || 'r2');
        const head = await storage.head(render.objectKey, render.bucket || undefined);
        storageVerified =
          head.exists &&
          (render.sizeBytes == null || head.sizeBytes === undefined || head.sizeBytes === render.sizeBytes);
      } catch {
        storageVerified = false;
      }
    }

    const dbReady =
      render.status === 'READY' &&
      !!render.objectKey &&
      (render.sizeBytes ?? 0) > 0 &&
      !!render.checksum;

    return NextResponse.json({
      success: true,
      data: {
        render: {
          id: render.id,
          videoId: render.videoId,
          version: render.version,
          status: render.status,
          bucket: render.bucket,
          objectKey: render.objectKey,
          mimeType: render.mimeType,
          sizeBytes: render.sizeBytes,
          checksum: render.checksum,
          durationSeconds: render.durationSeconds,
          durationFrames: render.durationFrames,
          width: render.width,
          height: render.height,
          fps: render.fps,
          storageProvider: render.storageProvider,
          createdAt: render.createdAt,
          completedAt: render.completedAt,
        },
        dbReady,
        storageVerified,
        verified: dbReady && storageVerified !== false,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_RENDER_STATUS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب حالة الإخراج' },
      { status: 500 }
    );
  }
}
