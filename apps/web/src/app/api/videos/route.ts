import { NextRequest, NextResponse } from 'next/server';
import {
  CreateVideoInputSchema,
  type N8nStartPayload,
  type VideoPlatform,
  type VideoAspectRatio,
} from '@video-factory/contracts';
import {
  createVideoWithJobTransaction,
  listVideos,
  getOrCreateDefaultUser,
} from '@video-factory/database';
import { triggerN8nJob } from '@/lib/n8n';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = CreateVideoInputSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'بيانات الطلب غير صالحة',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const input = validation.data;
    const user = await getOrCreateDefaultUser();

    // 1. Transactional persistence: creates video + job + initial job_event
    const { video, job } = await createVideoWithJobTransaction(input, user.id);

    // 2. Prepare canonical n8n start payload
    const n8nPayload: N8nStartPayload = {
      version: '1.0',
      job_id: job.id,
      video_id: video.id,
      request: {
        prompt: video.prompt,
        type: video.type as 'short' | 'long',
        duration_seconds: video.durationSeconds,
        language: (video.language || 'ar') as 'ar' | 'en',
        platform: video.platform as VideoPlatform,
        aspect_ratio: video.aspectRatio as VideoAspectRatio,
      },
    };

    // 3. Attempt to trigger external n8n orchestrator (handles failures gracefully without crashing)
    triggerN8nJob(n8nPayload).catch((err) => {
      console.error(`[N8N_TRIGGER_BACKGROUND_ERROR] job_id=${job.id}`, err);
    });

    return NextResponse.json(
      {
        success: true,
        video,
        job,
        redirectUrl: `/jobs/${job.id}`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_CREATE_VIDEO_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ غير متوقع أثناء إنشاء الفيديو، يرجى المحاولة مرة أخرى.',
      },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getOrCreateDefaultUser();
    const videosList = await listVideos({ userId: user.id });

    return NextResponse.json({
      success: true,
      videos: videosList,
    });
  } catch (error) {
    console.error('[API_LIST_VIDEOS_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'تعذر جلب قائمة الفيديوهات.',
      },
      { status: 500 }
    );
  }
}
