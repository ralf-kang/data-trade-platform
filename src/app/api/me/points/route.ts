import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getPointSummary } from '@/lib/services/memberService';

/**
 * 포인트 조회.
 *
 * 자동 적립은 아직 켜지 않았다 — 품질 게이트(5단계)가 없는 상태에서 보상을 열면
 * 공정성을 담보할 수단 없이 어뷰징이 먼저 학습된다. 원장이 비어 있으면
 * programStarted=false로 내려가고, 화면은 가짜 숫자 대신 "준비 중"을 표시한다.
 */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  return NextResponse.json({ points: await getPointSummary(user.id) });
}
