import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { RoleType, User, UserRole } from '@/generated/prisma/client';

/**
 * 로그인 화면(src/app/login/page.tsx)은 아직 세션 저장소 없이 `adminRole`/`adminEmail`
 * 쿠키만으로 신원을 표시한다. 이 헬퍼는 그 쿠키를 Postgres의 User 레코드와 이어주는
 * 다리 역할을 한다 — 첫 로그인 시 자동으로 계정을 만들어 둔다.
 *
 * NOTE: 목업에서 실서비스로 넘어가는 과도기용 임시 브릿지다. 신원이 포인트·개인정보와
 * 연결되기 전에 반드시 실제 인증(LDAP 또는 자격증명 + 정식 세션)으로 교체해야 한다.
 * 지금 구조는 쿠키를 그대로 신뢰하므로 누구나 타인 행세를 할 수 있다.
 */

/** 역할 목록을 함께 들고 다니는 사용자 — 권한 판정에 매번 재조회하지 않기 위함. */
export type ActingUser = User & { roles: UserRole[] };

/** 만료되지 않은 역할만 유효로 본다(한시적 위임 지원). 만료 행은 감사 이력으로 남긴다. */
function activeRoles(user: ActingUser): UserRole[] {
  const now = Date.now();
  return user.roles.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now);
}

/** 전역 역할 보유 여부 (양식 단위 위임은 hasFormRole로 확인). */
export function hasRole(user: ActingUser, role: RoleType): boolean {
  return activeRoles(user).some((r) => r.role === role && r.scopeFormId === null);
}

export function isPlatformAdmin(user: ActingUser): boolean {
  return hasRole(user, 'PLATFORM_ADMIN');
}

/** 특정 양식에 대한 역할 — 전역 권한이거나 해당 양식에 위임된 권한이면 true. */
export function hasFormRole(user: ActingUser, role: RoleType, formId: string): boolean {
  return activeRoles(user).some(
    (r) => r.role === role && (r.scopeFormId === null || r.scopeFormId === formId)
  );
}

export async function getCurrentUser(): Promise<ActingUser> {
  const store = await cookies();
  const cookieRole = (store.get('adminRole')?.value as 'admin' | 'super-admin' | undefined) || 'admin';
  const rawEmail = store.get('adminEmail')?.value;
  const email = rawEmail
    ? decodeURIComponent(rawEmail)
    : cookieRole === 'super-admin'
      ? 'admin@example.com'
      : 'admin@company.com';

  const existing = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
  if (existing) return existing;

  // 과도기 브릿지: 쿠키의 역할을 그대로 부여한다. 실제 인증 도입 시 이 분기는 사라진다.
  const created = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      source: 'LOCAL',
      roles: {
        create: [
          { role: 'MEMBER', grantedBy: 'auth-bridge' },
          {
            role: cookieRole === 'super-admin' ? 'PLATFORM_ADMIN' : 'AUTHOR',
            grantedBy: 'auth-bridge',
          },
        ],
      },
    },
    include: { roles: true },
  });
  return created;
}

/** @deprecated getCurrentUser를 사용할 것. 기존 호출부 호환을 위해 남겨둔다. */
export const getCurrentAdmin = getCurrentUser;

/**
 * 로그인 여부만 확인한다 (getCurrentUser와 달리, 쿠키가 없을 때 계정을 만들지 않는다).
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
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    { status: 401 }
  );
}

/**
 * 플랫폼 관리자(슈퍼관리자) 전용 API 보호. 쿠키가 아니라 DB에 저장된 실제 역할을 기준으로
 * 판단한다 (다른 관리자가 방금 승격/강등했을 수 있으므로 로그인 시점 쿠키를 신뢰하지 않는다).
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  if (!isPlatformAdmin(actor)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '슈퍼관리자만 접근할 수 있습니다.' },
      { status: 403 }
    );
  }
  return null;
}
