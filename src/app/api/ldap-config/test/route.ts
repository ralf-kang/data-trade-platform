import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { testConnection } from '@/lib/services/ldapService';

/**
 * 연결 테스트 — 연결 → TLS → 바인딩 → 검색을 단계별로 진단한다.
 *
 * body.bindPassword를 주면 저장하지 않고 그 값으로만 시험한다.
 * (설정을 저장하기 전에 비밀번호가 맞는지 먼저 확인할 수 있도록.)
 */
export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));

  try {
    const result = await testConnection(body?.bindPassword || undefined);
    // 진단 결과이므로 실패해도 200으로 돌려주고, 본문의 steps로 성패를 판단하게 한다.
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '연결 테스트에 실패했습니다.';
    return NextResponse.json(
      { success: false, steps: [{ step: 'CONNECT', ok: false, message }] },
      { status: 200 }
    );
  }
}
