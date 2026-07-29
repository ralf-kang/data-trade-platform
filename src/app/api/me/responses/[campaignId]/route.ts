import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getMyResponseDetail } from '@/lib/services/memberService';

type Params = { params: Promise<{ campaignId: string }> };

/**
 * 내 응답 상세.
 * 조회 키가 (본인 id, 회차)이므로 타인의 응답은 구조적으로 조회되지 않는다.
 * 익명 문항은 값이 null로 내려오고 화면에서 "조회할 수 없음"으로 표시된다.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { campaignId } = await params;
  const user = await getCurrentUser();
  const detail = await getMyResponseDetail(user.id, campaignId);
  if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ detail });
}
