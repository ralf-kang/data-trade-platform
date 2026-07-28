import { cookies } from 'next/headers';
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
