import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { RenderCallbackPayloadSchema } from '@video-factory/contracts';
import { updateRenderStatusTransaction } from '@video-factory/database';

export async function POST(request: NextRequest) {
  // 1. Authenticate with constant-time secret check
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json(
      { success: false, error: 'غير مصرح به' },
      { status: 401 }
    );
  }

  try {
    const rawBody = await request.json();
    const validation = RenderCallbackPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'بيانات حمولة الإخراج غير مطابقة للمخطط',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = validation.data;

    // 2. Persist Render Status
    await updateRenderStatusTransaction(
      payload.render_id,
      {
        status: payload.status,
        bucket: payload.render_output?.bucket,
        objectKey: payload.render_output?.objectKey,
        sizeBytes: payload.render_output?.sizeBytes,
        checksum: payload.render_output?.checksum,
        durationSeconds: payload.render_output?.durationSeconds
          ? String(payload.render_output.durationSeconds)
          : undefined,
        completedAt: payload.status === 'READY' ? new Date() : undefined,
      },
      {
        jobId: payload.job_id,
        message: payload.message,
        errorCode: payload.error?.code,
        errorMessage: payload.error?.message,
      }
    );

    return NextResponse.json({
      success: true,
      stage: payload.stage,
      progress: payload.progress,
      status: payload.status,
      message: 'تم تحديث وتسجيل حالة إخراج الفيديو النهائي بنجاح',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_RENDER_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء معالجة بيانات إخراج الفيديو',
      },
      { status: 500 }
    );
  }
}
