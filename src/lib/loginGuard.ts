import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import type { ActingUser } from '@/lib/auth';

/**
 * 로그인 라우트 공용 헬퍼.
 *
 * 클라이언트 IP: 앞단 nginx(docker/nginx/nginx.conf)가 X-Real-IP를 $remote_addr로 매번
 * 덮어쓰므로 클라이언트가 위조할 수 없다. (컨테이너 직접 노출 없이 nginx만 외부에 열려 있음)
 */
export function clientIp(request: NextRequest): string {
  return request.headers.get('x-real-ip') || 'unknown';
}

/** 무차별 대입 방지 — 키별 고정 윈도우. 초과 시 429 응답을 돌려준다. */
export function limitOrNull(key: string, limit: number, windowMs: number): NextResponse | null {
  const r = checkRateLimit(key, limit, windowMs);
  if (r.allowed) return null;
  const retryAfter = Math.ceil(r.retryAfterMs / 1000);
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도하세요.` },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

/** 로그인 직후 이동할 곳 — 실제 DB 역할 기준. */
export function landingFor(user: ActingUser): { role: 'admin' | 'super-admin'; redirect: string } {
  const now = Date.now();
  const roles = user.roles
    .filter((r) => r.scopeFormId === null && (!r.expiresAt || r.expiresAt.getTime() > now))
    .map((r) => r.role);
  if (roles.includes('PLATFORM_ADMIN')) return { role: 'super-admin', redirect: '/super-admin' };
  if (roles.includes('AUTHOR')) return { role: 'admin', redirect: '/admin/dashboard' };
  return { role: 'admin', redirect: '/me' };
}
