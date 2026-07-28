import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { AdminUser } from '@/generated/prisma/client';

/**
 * 로그인 화면(src/app/login/page.tsx)은 아직 세션 저장소 없이 `adminRole`/`adminEmail`
 * 쿠키만으로 신원을 표시한다. 이 헬퍼는 그 쿠키를 Postgres의 AdminUser 레코드와 이어주는
 * 다리 역할을 한다 — 첫 로그인 시 자동으로 계정을 만들어 둔다(seed 데이터 또는 기존 계정이
 * 있으면 그대로 사용).
 *
 * NOTE: 목업에서 실서비스로 넘어가는 과도기용 임시 브릿지다. 실제 운영 전환 시에는
 * 비밀번호 해시 검증 + 정식 세션(JWT/DB 세션) 기반의 인증으로 교체해야 한다.
 */
export async function getCurrentAdmin(): Promise<AdminUser> {
  const store = await cookies();
  const role = (store.get('adminRole')?.value as 'admin' | 'super-admin' | undefined) || 'admin';
  const rawEmail = store.get('adminEmail')?.value;
  const email = rawEmail
    ? decodeURIComponent(rawEmail)
    : role === 'super-admin'
      ? 'ralfkang@ktl.re.kr'
      : 'admin@company.com';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.adminUser.create({
    data: {
      email,
      name: email.split('@')[0],
      // 데모/목업 단계의 임시 값. 실제 비밀번호 인증 도입 전까지는 사용되지 않는다.
      password: 'unset',
      role: role === 'super-admin' ? 'SUPER_ADMIN' : 'ADMIN',
    },
  });
}

/**
 * 로그인 여부만 확인한다 (getCurrentAdmin과 달리, 쿠키가 없을 때 임의로 admin 계정을
 * 만들어주지 않는다).
 *
 * 기술적 보호조치(저작권법 제93조·제104조의2 준용) 목적: 수집된 제출 데이터(비정형,
 * Elasticsearch)는 데이터베이스제작자의 상당한 투자가 들어간 데이터베이스이므로, 비로그인
 * 상태의 무단 접근·반복적/체계적 추출을 막기 위해 관리자 API는 반드시 이 검사를 거쳐야 한다.
 */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return !!store.get('adminRole')?.value;
}

/**
 * 관리자 전용 API Route Handler 맨 앞에서 호출한다.
 * 인증되지 않았으면 401 응답을, 인증되었으면 null을 반환한다.
 *
 * 사용 예:
 *   const unauthorized = await requireAdmin();
 *   if (unauthorized) return unauthorized;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    { status: 401 }
  );
}
