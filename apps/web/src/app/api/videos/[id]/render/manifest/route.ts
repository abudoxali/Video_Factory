import { NextRequest, NextResponse } from 'next/server';
import { RenderCoordinator } from '@video-factory/providers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const coordinator = new RenderCoordinator();
    const manifest = await coordinator.buildRenderManifest(videoId);

    return NextResponse.json({
      success: true,
      data: manifest,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_GET_RENDER_MANIFEST_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'تعذر بناء مخطط معاينة الفيديو' },
      { status: 400 }
    );
  }
}
