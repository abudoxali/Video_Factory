import { NextRequest, NextResponse } from 'next/server';
import { getJobWithDetails } from '@video-factory/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const details = await getJobWithDetails(id);

    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: 'المهمة المطلوبة غير موجودة.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: details.job,
      video: details.video,
      events: details.events,
    });
  } catch (error) {
    console.error('[API_GET_JOB_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'تعذر جلب تفاصيل حالة المهمة.',
      },
      { status: 500 }
    );
  }
}
