import { NextRequest, NextResponse } from 'next/server';
import { getVideoPlanDetails } from '@video-factory/database';
import { MediaCoordinator } from '@video-factory/providers';

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

    if (plan.video.planStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: 'لا يمكن بدء توليد الوسائط قبل اعتماد خطة الفيديو. يرجى مراجعة الخطة واعتمادها أولاً.',
        },
        { status: 400 }
      );
    }

    const coordinator = new MediaCoordinator();
    const result = await coordinator.executeMediaPipeline({
      videoId,
      userId: plan.video.userId || undefined,
      projectId: plan.video.projectId || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'تمت معالجة وسائط المشاهد بنجاح',
      data: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_MEDIA_GENERATE_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء توليد وسائط الفيديو' },
      { status: 500 }
    );
  }
}
