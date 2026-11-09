import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { loginWithDirectory } from '@/lib/services/ldapService';
import { logAudit } from '@/lib/services/auditService';
import { writeSession } from '@/lib/session';
import { clientIp, landingFor, limitOrNull } from '@/lib/loginGuard';

/**
 * Windows(AD/LDAP) 계정 로그인 — 아이디/비밀번호를 디렉터리에 바인딩해 검증한다.
 * (Kerberos 자동 SSO가 아니라, 평소 PC 로그인에 쓰는 계정·비밀번호를 그대로 입력하는 방식)
 */
const FAIL_MESSAGE: Record<string, string> = {
  DISABLED: 'Windows 계정 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요.',
  INVALID_CREDENTIALS: '아이디 또는 비밀번호가 올바르지 않습니다.',
  NO_EMAIL: '디렉터리 계정에 이메일 정보가 없어 로그인할 수 없습니다. 관리자에게 문의하세요.',
  LOCAL_CONFLICT: '같은 이메일의 로컬 계정이 이미 있어 Windows 계정과 연결할 수 없습니다. 관리자에게 문의하세요.',
  INACTIVE: '정지되었거나 이탈 처리된 계정입니다. 관리자에게 문의하세요.',
  SERVER_ERROR: '디렉터리 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.',
};

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = limitOrNull(`ldap-login:${ip}`, 10, 5 * 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const result = await loginWithDirectory(username, password);
  if (!result.ok) {
    if (result.reason === 'SERVER_ERROR') console.error('[ldap-login] directory error:', result.detail);
    await logAudit({
      userEmail: username.slice(0, 100) || '(empty)',
      action: 'LOGIN_FAILED',
      target: 'Auth / Windows',
      details: `Windows 계정 로그인 실패 (${result.reason}, ip=${ip})`,
      severity: 'warning',
    });
    return NextResponse.json(
      { error: result.reason, message: FAIL_MESSAGE[result.reason] },
      { status: result.reason === 'SERVER_ERROR' ? 502 : 401 }
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id }, include: { roles: true } });
  const landing = landingFor(user);
  await writeSession(user.email, landing.role);
  await logAudit({
    userEmail: user.email,
    action: 'LOGIN',
    target: 'Auth / Windows',
    details: `Windows 계정 로그인${result.created ? ' (첫 로그인 — 계정 자동 생성)' : ''} (ip=${ip})`,
    severity: 'info',
  });
  return NextResponse.json({ ok: true, redirect: landing.redirect, name: user.name });
}
