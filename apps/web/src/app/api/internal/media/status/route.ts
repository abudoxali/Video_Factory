import { NextRequest, NextResponse } from 'next/server';
import { verifyCallbackSecret } from '@/lib/auth-check';
import {
  summarizeSceneMediaStates,
  type MediaAssetType,
  type SceneMediaState,
} from '@video-factory/contracts';
import { getVideoPlanDetails, getVideoMediaAssets } from '@video-factory/database';
import { createStorageProvider } from '@video-factory/providers';

/**
 * GET /api/internal/media/status?video_id=…&verify_storage=1
 *
 * Read-only truthful media audit for VF-08. Reports per-scene media state and
 * ACTIVE asset presence straight from the database; with verify_storage=1 each
 * active asset's objectKey is additionally verified against real storage via
 * head(). No state is ever written here.
 */
export async function GET(request: NextRequest) {
  const secretHeader = request.headers.get('x-callback-secret');
  if (!verifyCallbackSecret(secretHeader)) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const videoId = request.nextUrl.searchParams.get('video_id');
    const verifyStorage = request.nextUrl.searchParams.get('verify_storage') === '1';
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'video_id مطلوب' },
        { status: 400 }
      );
    }

    const plan = await getVideoPlanDetails(videoId);
    if (!plan?.video) {
      return NextResponse.json(
        { success: false, error: 'الفيديو غير موجود' },
        { status: 404 }
      );
    }

    const assets = await getVideoMediaAssets(videoId);
    const activeAssets = assets.filter((a) => a.status === 'ACTIVE');

    // Optional real storage verification — READY claims are proven, not trusted.
    const storageChecks: Record<string, boolean | null> = {};
    if (verifyStorage) {
      const storage = createStorageProvider();
      for (const asset of activeAssets) {
        try {
          const head = await storage.head(asset.objectKey, asset.bucket || undefined);
          storageChecks[asset.id] = head.exists;
        } catch {
          storageChecks[asset.id] = null;
        }
      }
    }

    const scenes = plan.scenes.map((scene) => {
      const visualTypes: MediaAssetType[] =
        scene.mediaStrategy === 'AI_IMAGE' || scene.mediaStrategy === 'MIXED'
          ? ['IMAGE']
          : scene.mediaStrategy === 'AI_VIDEO'
            ? ['VIDEO']
            : [];
      const visualAsset = activeAssets.find(
        (a) => a.sceneId === scene.id && visualTypes.includes(a.type as MediaAssetType)
      );
      const voiceAsset = activeAssets.find(
        (a) => a.sceneId === scene.id && a.type === 'VOICE'
      );
      const voiceRequired = !!(scene.narration && scene.narration.trim().length > 0);

      const storageVerified = verifyStorage
        ? [visualAsset, voiceAsset]
            .filter(Boolean)
            .every((a) => storageChecks[a!.id] === true)
        : null;

      return {
        sceneId: scene.id,
        position: scene.position,
        mediaStrategy: scene.mediaStrategy,
        mediaState: scene.mediaState as SceneMediaState,
        visualRequired: visualTypes.length > 0,
        hasVisualAsset: !!visualAsset,
        voiceRequired,
        hasVoiceAsset: !!voiceAsset,
        storageVerified,
      };
    });

    const summary = summarizeSceneMediaStates(scenes);
    const storageAllVerified =
      !verifyStorage || Object.values(storageChecks).every((v) => v === true);

    return NextResponse.json({
      success: true,
      video_id: videoId,
      data: {
        planStatus: plan.video.planStatus,
        scenes,
        summary,
        assets: activeAssets.map((a) => ({
          id: a.id,
          sceneId: a.sceneId,
          type: a.type,
          objectKey: a.objectKey,
          bucket: a.bucket,
          sizeBytes: a.sizeBytes,
          checksum: a.checksum,
          storageVerified: storageChecks[a.id] ?? null,
        })),
        /** True when every scene resolved without failures (storage-proven when requested). */
        verified: summary.allReady && storageAllVerified,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_INTERNAL_MEDIA_STATUS_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر جلب حالة الوسائط' },
      { status: 500 }
    );
  }
}
