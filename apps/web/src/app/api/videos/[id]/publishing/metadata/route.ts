import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getVideoPlanDetails } from '@video-factory/database';
import { PublishingMetadataGenerator } from '@video-factory/providers';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const { id: videoId } = await params;
    const plan = await getVideoPlanDetails(videoId);

    if (!plan || !plan.video) {
      return NextResponse.json({ success: false, error: 'الفيديو غير موجود' }, { status: 404 });
    }

    if (plan.video.userId && plan.video.userId !== user.userId) {
      return NextResponse.json({ success: false, error: 'غير مصرح لك بالوصول لهذا الفيديو' }, { status: 403 });
    }

    const generator = new PublishingMetadataGenerator();
    const metadata = await generator.generateMetadata({
      title: plan.video.title,
      briefSummary: plan.brief?.coreIdea || plan.brief?.objective,
      scriptText: plan.script?.fullNarration,
      platform: plan.video.platform,
    });

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_GENERATE_METADATA_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر توليد بيانات النشر الذكية' },
      { status: 500 }
    );
  }
}
