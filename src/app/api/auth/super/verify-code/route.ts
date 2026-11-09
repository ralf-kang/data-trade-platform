import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { superAdminEmail, verifyCode } from '@/lib/superAdminOtp';
import { writeSession } from '@/lib/session';
import { logAudit } from '@/lib/services/auditService';
import { clientIp, limitOrNull } from '@/lib/loginGuard';

const FAIL_MESSAGE = {
  INVALID: '인증번호가 일치하지 않습니다.',
  EXPIRED: '인증번호가 만료되었습니다. 다시 받아주세요.',
  NO_CODE: '먼저 인증번호를 받아주세요.',
  TOO_MANY_ATTEMPTS: '오답이 너무 많아 인증번호가 폐기되었습니다. 다시 받아주세요.',
} as const;

/** 전역(양식 범위 아님)·미만료 역할이 없으면 부여한다. (scopeFormId=null 은 복합 unique로 upsert 불가) */
async function ensureGlobalRole(userId: string, role: 'MEMBER' | 'PLATFORM_ADMIN') {
  const existing = await prisma.userRole.findFirst({ where: { userId, role, scopeFormId: null } });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, role, grantedBy: 'super-admin-otp' } });
  } else if (existing.expiresAt) {
    await prisma.userRole.update({ where: { id: existing.id }, data: { expiresAt: null } });
  }
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = limitOrNull(`super-otp-verify:${ip}`, 10, 10 * 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const email = superAdminEmail();

  const result = verifyCode(email, code);
  if (result !== 'OK') {
    await logAudit({
      userEmail: email,
      action: 'LOGIN_FAILED',
      target: 'Auth / Super Admin OTP',
      details: `최고관리자 인증번호 검증 실패 (${result}, ip=${ip})`,
      severity: 'warning',
    });
    return NextResponse.json({ error: result, message: FAIL_MESSAGE[result] }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { status: 'ACTIVE', lastLoginAt: new Date() },
    create: { email, name: '최고관리자', source: 'LOCAL', status: 'ACTIVE', lastLoginAt: new Date() },
  });
  await ensureGlobalRole(user.id, 'MEMBER');
  await ensureGlobalRole(user.id, 'PLATFORM_ADMIN');

  await writeSession(email, 'super-admin');
  await logAudit({
    userEmail: email,
    action: 'LOGIN',
    target: 'Auth / Super Admin OTP',
    details: `최고관리자 이메일 인증 로그인 (ip=${ip})`,
    severity: 'warning',
  });
  return NextResponse.json({ ok: true, redirect: '/super-admin' });
}
