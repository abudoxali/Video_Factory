import { NextRequest, NextResponse } from 'next/server';
import { getVideoPlanDetails, updateVideoPlanDetailsTransaction } from '@video-factory/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const planDetails = await getVideoPlanDetails(id);

    if (!planDetails || !planDetails.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: planDetails,
    });
  } catch (error) {
    console.error('[API_GET_VIDEO_PLAN_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب تفاصيل خطة الفيديو' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json();

    const updated = await updateVideoPlanDetailsTransaction(videoId, {
      title: body.title,
      scriptText: body.scriptText,
      scenes: body.scenes,
    });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ التعديلات بنجاح وتحديث الخط الزمني',
      data: updated,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_PATCH_VIDEO_PLAN_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء تعديل الخطة' },
      { status: 500 }
    );
  }
}
