import { NextRequest, NextResponse } from 'next/server';
import { MediaCoordinator } from '@video-factory/providers';
import type { MediaAssetType } from '@video-factory/contracts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  try {
    const { id: videoId, sceneId } = await params;
    const body = await request.json().catch(() => ({}));
    const assetType: MediaAssetType = body.assetType || 'IMAGE';
    const promptOverride: string | undefined = body.promptOverride;

    const coordinator = new MediaCoordinator();
    const asset = await coordinator.regenerateSceneAsset({
      sceneId,
      videoId,
      assetType,
      promptOverride,
    });

    return NextResponse.json({
      success: true,
      message: 'تمت إعادة إنشاء مادة المشهد بنجاح',
      data: asset,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_REGENERATE_SCENE_MEDIA_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء إعادة توليد المادة' },
      { status: 500 }
    );
  }
}
