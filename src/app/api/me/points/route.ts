import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getGatedPointSummary } from '@/lib/services/memberService';

/**
 * 포인트 조회.
 *
 * 자동 적립은 아직 켜지 않았다 — 품질 게이트(5단계)가 없는 상태에서 보상을 열면
 * 공정성을 담보할 수단 없이 어뷰징이 먼저 학습된다. 원장이 비어 있으면
 * programStarted=false로 내려가고, 화면은 가짜 숫자 대신 "준비 중"을 표시한다.
 *
 * 노출 여부는 canSeeRewards() 한 곳(§보상 화면 가시성)에서만 판정한다 — 화면단
 * 숨김만으로는 이 엔드포인트로 그대로 우회되므로, 게이트는 여기(서비스 계층)에서 건다.
 */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  const gated = await getGatedPointSummary(user);
  return NextResponse.json(gated);
}
