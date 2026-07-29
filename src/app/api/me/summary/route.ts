import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getMemberSummary, getPendingActions } from '@/lib/services/memberService';

/** 마이페이지 대시보드 — 본인 데이터만 반환하므로 별도 권한 검사는 로그인 확인으로 충분하다. */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  const [summary, pending] = await Promise.all([
    getMemberSummary(user.id),
    getPendingActions(user.id),
  ]);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, department: user.department },
    summary,
    pending,
  });
}
