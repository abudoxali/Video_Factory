import { NextRequest, NextResponse } from 'next/server';
import { getVideoPlanDetails, getVideoMediaAssets } from '@video-factory/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const plan = await getVideoPlanDetails(videoId);

    if (!plan || !plan.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }

    const assets = await getVideoMediaAssets(videoId);

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        planStatus: plan.video.planStatus,
        scenes: plan.scenes,
        assets,
      },
    });
  } catch (error) {
    console.error('[API_GET_VIDEO_MEDIA_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب بيانات وسائط الفيديو' },
      { status: 500 }
    );
  }
}
