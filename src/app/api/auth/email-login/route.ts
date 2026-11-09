import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeSession } from '@/lib/session';
import { clientIp, landingFor, limitOrNull } from '@/lib/loginGuard';
import { superAdminEmail } from '@/lib/superAdminOtp';

/**
 * 이메일 간편 로그인(과도기용) — 기존 로그인 화면의 "이메일만 입력" 동작을 서버로 옮긴 것.
 *
 * 비밀번호 검증이 없으므로 **Windows(LDAP) 연동이 켜지면 자동으로 차단**된다. 운영자가
 * 최고관리자 OTP로 들어가 LDAP를 설정하기 전까지 기존 사용자의 접속이 끊기지 않게 하려는
 * 임시 경로다. 최고관리자 권한은 이 경로로 절대 얻을 수 없다(세션 role은 항상 'admin').
 */
export async function POST(request: NextRequest) {
  const limited = limitOrNull(`email-login:${clientIp(request)}`, 10, 5 * 60_000);
  if (limited) return limited;

  const ldap = await prisma.ldapConfig.findUnique({ where: { id: 'default' }, select: { enabled: true } });
  if (ldap?.enabled) {
    return NextResponse.json(
      { error: 'LDAP_REQUIRED', message: 'Windows 계정 로그인을 사용해 주세요.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const target = body?.target === 'admin' ? 'admin' : 'member';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'INVALID_EMAIL', message: '올바른 이메일 주소를 입력하세요.' }, { status: 400 });
  }

  // 첫 로그인이면 MEMBER+AUTHOR 계정 생성(기존 브릿지 동작과 동일)
  const user =
    (await prisma.user.findUnique({ where: { email }, include: { roles: true } })) ??
    (await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        source: 'LOCAL',
        roles: {
          create: [
            { role: 'MEMBER', grantedBy: 'email-login' },
            { role: 'AUTHOR', grantedBy: 'email-login' },
          ],
        },
      },
      include: { roles: true },
    }));
  if (user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'INACTIVE', message: '정지되었거나 이탈 처리된 계정입니다.' }, { status: 403 });
  }
  // 최고관리자 권한 계정은 비밀번호 없는 이 경로로 세션을 받을 수 없다 — 받으면 DB 역할
  // 기준인 requireSuperAdmin()을 그대로 통과해 인증번호(OTP)를 우회하게 된다.
  const landing = landingFor(user);
  if (email === superAdminEmail() || landing.role === 'super-admin') {
    return NextResponse.json(
      { error: 'SUPER_ADMIN_OTP_REQUIRED', message: '최고관리자 계정은 "최고 관리자" 탭의 이메일 인증번호로 로그인하세요.' },
      { status: 403 }
    );
  }
  await writeSession(email, 'admin');
  // 이 경로로는 최고관리자 화면에 들어가지 않는다 — 최고관리자는 인증번호 로그인 전용.
  const redirect = target === 'member' ? '/me' : landing.redirect;
  return NextResponse.json({ ok: true, redirect });
}
