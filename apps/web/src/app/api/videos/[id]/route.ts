import { NextRequest, NextResponse } from 'next/server';
import { getVideoById } from '@video-factory/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await getVideoById(id);

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: 'الفيديو المطلوب غير موجود.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      video,
    });
  } catch (error) {
    console.error('[API_GET_VIDEO_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'تعذر جلب بيانات الفيديو.',
      },
      { status: 500 }
    );
  }
}
