import { NextRequest, NextResponse } from 'next/server';
import { N8nCallbackPayloadSchema } from '@video-factory/contracts';
import { applyJobCallbackEvent } from '@video-factory/database';
import { verifyCallbackSecret } from '@/lib/auth-check';

export async function POST(request: NextRequest) {
  // 1. Authenticate Request
  const secretHeader =
    request.headers.get('x-callback-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!verifyCallbackSecret(secretHeader)) {
    console.warn('[CALLBACK_AUTH_FAILED] Invalid or missing callback secret');
    return NextResponse.json(
      {
        success: false,
        error: 'غير مصرح: مفتاح التحقق مفقود أو غير صحيح.',
      },
      { status: 401 }
    );
  }

  // 2. Validate Payload
  try {
    const rawBody = await request.json();
    const validation = N8nCallbackPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      console.error('[CALLBACK_SCHEMA_INVALID]', validation.error.format());
      return NextResponse.json(
        {
          success: false,
          error: 'صيغة بيانات الحدث غير صالحة',
          issues: validation.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = validation.data;

    // 3. Process callback with idempotency and state machine transitions
    const result = await applyJobCallbackEvent(payload);

    if (!result.success) {
      if (result.error === 'JOB_NOT_FOUND') {
        return NextResponse.json(
          {
            success: false,
            error: `المهمة المطلوبة [${payload.job_id}] غير موجودة.`,
          },
          { status: 404 }
        );
      }

      console.warn(`[CALLBACK_TRANSITION_REJECTED] ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'تعذر تطبيق تحديث حالة المهمة.',
        },
        { status: 400 }
      );
    }

    // 4. Return success response
    return NextResponse.json({
      success: true,
      job_id: payload.job_id,
      event_id: payload.event_id,
      status: payload.status,
      stage: payload.stage,
      progress: payload.progress,
      idempotent: !!result.idempotent,
    });
  } catch (error) {
    console.error('[CALLBACK_PROCESSING_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ داخلي أثناء معالجة الحدث.',
      },
      { status: 500 }
    );
  }
}
