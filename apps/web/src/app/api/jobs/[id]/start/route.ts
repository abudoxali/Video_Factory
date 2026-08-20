import { NextRequest, NextResponse } from 'next/server';
import { getJobWithDetails } from '@video-factory/database';
import { triggerN8nJob } from '@/lib/n8n';
import type {
  N8nStartPayload,
  VideoPlatform,
  VideoAspectRatio,
} from '@video-factory/contracts';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const details = await getJobWithDetails(id);

    if (!details || !details.video) {
      return NextResponse.json(
        {
          success: false,
          error: 'المهمة أو الفيديو غير موجود.',
        },
        { status: 404 }
      );
    }

    const { job, video } = details;

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

    const triggerResult = await triggerN8nJob(n8nPayload);

    return NextResponse.json({
      success: triggerResult.success,
      jobId: job.id,
      message: triggerResult.success
        ? 'تم إرسال المهمة بنجاح إلى سير عمل n8n'
        : 'تعذر تشغيل سير العمل، تم حفظ المحاولة كحدث تشخيصي',
      error: triggerResult.error,
    });
  } catch (error) {
    console.error('[API_START_JOB_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء تشغيل المهمة.',
      },
      { status: 500 }
    );
  }
}
