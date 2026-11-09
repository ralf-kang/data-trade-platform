import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

/**
 * 로그아웃 — 세션 쿠키를 실제로 지운다.
 *
 * 기존에는 /login으로 링크만 걸어두어 쿠키가 그대로 남았다. 공용 PC에서 "로그아웃했다"고
 * 믿고 자리를 뜨면 다음 사람이 URL만 쳐도 그대로 들어와지는 상태였다.
 */
export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
