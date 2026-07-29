import { NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { syncUsers } from '@/lib/services/ldapService';

/**
 * LDAP 사용자 동기화 실행.
 *
 * 신규 계정 생성 + 기존 계정 갱신 + 디렉터리에서 사라진 계정의 LEFT 전환까지 수행한다.
 * 계정을 삭제하지는 않는다 — 과거 응답·소유 이력이 끊기면 안 되기 때문이다.
 */
export async function POST() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const actor = await getCurrentUser();

  try {
    const result = await syncUsers(actor.email);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'LDAP_DISABLED') {
      return NextResponse.json(
        { error: 'LDAP_DISABLED', message: 'LDAP 연동이 비활성 상태입니다. 먼저 활성화하고 저장하세요.' },
        { status: 409 }
      );
    }
    if (message === 'LDAP_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'LDAP_NOT_CONFIGURED', message: '호스트와 Base DN을 먼저 설정하세요.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'LDAP_SYNC_FAILED', message }, { status: 500 });
  }
}
