import { NextRequest, NextResponse } from 'next/server';
import {
  getVideoPlanDetails,
  getVideoRenders,
  getActiveVideoRender,
} from '@video-factory/database';
import { RenderCoordinator } from '@video-factory/providers';
import { RenderService } from '@video-factory/render-worker/service';

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
          error: 'لا يمكن إخراج الفيديو قبل اعتماد الخطة وتوليد المواد. يرجى مراجعة الخطة واعتمادها أولاً.',
        },
        { status: 400 }
      );
    }

    // 1. Build Manifest via RenderCoordinator
    const coordinator = new RenderCoordinator();
    const manifest = await coordinator.buildRenderManifest(videoId);

    // 2. Execute Render via RenderService
    const renderService = new RenderService();
    const result = await renderService.renderVideo({
      manifest,
      userId: plan.video.userId || undefined,
      projectId: plan.video.projectId || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'فشل إخراج الفيديو النهائي',
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إخراج وتخزين الفيديو النهائي بنجاح في Cloudflare R2',
      data: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_VIDEO_RENDER_ERROR]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'حدث خطأ أثناء معالجة إخراج الفيديو' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const activeRender = await getActiveVideoRender(videoId);
    const allRenders = await getVideoRenders(videoId);

    return NextResponse.json({
      success: true,
      data: {
        activeRender,
        renders: allRenders,
      },
    });
  } catch (error) {
    console.error('[API_GET_VIDEO_RENDERS_ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب بيانات إخراج الفيديو' },
      { status: 500 }
    );
  }
}
