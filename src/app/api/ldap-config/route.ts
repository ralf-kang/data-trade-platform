import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { getLdapConfig, updateLdapConfig } from '@/lib/services/ldapService';

// LDAP 설정은 조직 전체의 계정 출처를 좌우하므로 슈퍼관리자 전용이다.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  // bindPassword는 반환하지 않는다 (저장 여부만 hasBindPassword로 알린다).
  return NextResponse.json({ config: await getLdapConfig() });
}

export async function PATCH(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const actor = await getCurrentUser();
  const body = await request.json();

  try {
    const config = await updateLdapConfig(body, actor.email);
    return NextResponse.json({ config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '설정 저장에 실패했습니다.';
    // 암호화 키 미설정은 운영자가 조치해야 하는 사항이므로 메시지를 그대로 노출한다.
    return NextResponse.json({ error: 'LDAP_CONFIG_UPDATE_FAILED', message }, { status: 400 });
  }
}
