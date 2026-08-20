import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { PlanningPayloadSchema } from '@video-factory/contracts';
import { saveCompletePlanningBundleTransaction } from '@video-factory/database';

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
    const validation = PlanningPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'بيانات حمولة التخطيط غير مطابقة للمخطط',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = validation.data;

    // 2. Persist planning bundle in database transaction
    await saveCompletePlanningBundleTransaction(payload);

    return NextResponse.json({
      success: true,
      stage: payload.stage,
      progress: payload.progress,
      message: 'تم حفظ وتحديث بيانات التخطيط الإنتاجي بنجاح',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_PLANNING_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء حفظ بيانات التخطيط',
      },
      { status: 500 }
    );
  }
}
