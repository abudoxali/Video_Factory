import { NextRequest, NextResponse } from 'next/server';
import { approveVideoPlan, getVideoPlanDetails } from '@video-factory/database';

export async function POST(
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

    if (plan.scenes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'لا يمكن اعتماد خطة فارغة لا تحتوي على مشاهد' },
        { status: 400 }
      );
    }

    const updated = await approveVideoPlan(videoId);

    return NextResponse.json({
      success: true,
      message: 'تم اعتماد خطة الإنتاج بنجاح وجاهزيتها للمرحلة التالية',
      video: updated,
    });
  } catch (error) {
    console.error('[API_APPROVE_PLAN_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء اعتماد الخطة' },
      { status: 500 }
    );
  }
}
