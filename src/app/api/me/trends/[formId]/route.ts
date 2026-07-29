import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getMyTrend } from '@/lib/services/memberService';

type Params = { params: Promise<{ formId: string }> };

/** 반복 수집 양식에서 내 값의 회차별 변화. 회차가 2개 미만이면 404. */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const user = await getCurrentUser();
  const trend = await getMyTrend(user.id, formId);
  if (!trend) {
    return NextResponse.json(
      { error: 'NOT_ENOUGH_CAMPAIGNS', message: '추세를 보려면 이 양식에 2회 이상 응답해야 합니다.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ trend });
}
