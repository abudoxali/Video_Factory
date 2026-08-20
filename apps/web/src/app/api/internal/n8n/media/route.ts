import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import { MediaCallbackPayloadSchema } from '@video-factory/contracts';
import {
  saveMediaAssetTransaction,
  updateSceneMediaStateTransaction,
} from '@video-factory/database';

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
    const validation = MediaCallbackPayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'بيانات حمولة الوسائط غير مطابقة للمخطط',
          details: validation.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = validation.data;

    // 2. Persist Asset if provided
    if (payload.asset) {
      await saveMediaAssetTransaction(
        {
          videoId: payload.video_id,
          sceneId: payload.scene_id || null,
          type: payload.asset.type,
          source: payload.asset.source || 'GENERATED',
          provider: payload.asset.provider,
          model: payload.asset.model,
          providerRequestId: payload.asset.providerRequestId || null,
          storageProvider: payload.asset.storageProvider || 'r2',
          bucket: payload.asset.bucket,
          objectKey: payload.asset.objectKey,
          mimeType: payload.asset.mimeType,
          sizeBytes: payload.asset.sizeBytes,
          width: payload.asset.width || null,
          height: payload.asset.height || null,
          durationSeconds: payload.asset.durationSeconds ? String(payload.asset.durationSeconds) : null,
          status: payload.asset.status || 'ACTIVE',
          checksum: payload.asset.checksum || null,
        },
        {
          jobId: payload.job_id,
          targetMediaState: payload.scene_media_state || 'READY',
        }
      );
    } else if (payload.scene_id && payload.scene_media_state) {
      await updateSceneMediaStateTransaction(
        payload.scene_id,
        payload.scene_media_state,
        payload.job_id,
        payload.message
      );
    }

    return NextResponse.json({
      success: true,
      stage: payload.stage,
      progress: payload.progress,
      message: 'تم حفظ وتحديث بيانات وسائط المشهد بنجاح',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_MEDIA_ERROR]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء معالجة وسائط المشهد',
      },
      { status: 500 }
    );
  }
}
