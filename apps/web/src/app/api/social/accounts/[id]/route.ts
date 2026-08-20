import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { disconnectSocialAccount } from '@video-factory/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'غير مصرح به' }, { status: 401 });
  }

  try {
    const { id: accountId } = await params;
    const disconnected = await disconnectSocialAccount(accountId, user.userId);

    if (!disconnected) {
      return NextResponse.json(
        { success: false, error: 'الحساب غير موجود أو غير مملوك للمستخدم' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم قطع اتصال الحساب بنجاح وإلغاء صلاحيات النشر النشطة',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API_DISCONNECT_SOCIAL_ACCOUNT_ERROR]', err);
    return NextResponse.json(
      { success: false, error: 'تعذر قطع اتصال الحساب' },
      { status: 500 }
    );
  }
}
