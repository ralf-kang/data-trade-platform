import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/**
 * 서버 서명 세션 쿠키.
 *
 * 기존에는 로그인 화면이 브라우저에서 `adminRole`/`adminEmail` 쿠키를 직접 심었고, 서버는
 * 그 값을 그대로 믿었다 — devtools로 쿠키만 바꾸면 누구든 타인(최고관리자 포함) 행세가
 * 가능했다. 이제 쿠키는 서버의 로그인 라우트(LDAP·OTP 검증 통과 후)만 발급하고,
 * `wreSession`(HMAC-SHA256 서명)이 일치할 때만 유효한 세션으로 인정한다.
 *
 * `adminRole`/`adminEmail` 쿠키 이름은 기존 코드 호환을 위해 그대로 둔다(값만 서명으로 보호).
 * 서명 키: SESSION_SECRET → 없으면 APP_ENCRYPTION_KEY(운영에 이미 설정됨).
 */

export type SessionRole = 'admin' | 'super-admin';

export interface Session {
  email: string;
  role: SessionRole;
}

const ROLE_COOKIE = 'adminRole';
const EMAIL_COOKIE = 'adminEmail';
const SIG_COOKIE = 'wreSession';
/** 세션 유효 시간 — 공용 PC 방치 위험을 줄이기 위해 하루 업무시간 수준으로 제한 */
const MAX_AGE_SEC = 60 * 60 * 12;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.APP_ENCRYPTION_KEY;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET(또는 APP_ENCRYPTION_KEY) 환경변수가 설정되지 않아 세션을 발급할 수 없습니다.');
  }
  return s;
}

function sign(email: string, role: string, exp: number): string {
  return createHmac('sha256', secret()).update(`${email}\n${role}\n${exp}`).digest('base64url');
}

function isRole(v: string | undefined): v is SessionRole {
  return v === 'admin' || v === 'super-admin';
}

/** 서명이 유효한 세션만 반환한다. 위조·만료·키 미설정이면 null. */
export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const role = store.get(ROLE_COOKIE)?.value;
  const rawEmail = store.get(EMAIL_COOKIE)?.value;
  const sigCookie = store.get(SIG_COOKIE)?.value;
  if (!isRole(role) || !rawEmail || !sigCookie) return null;

  const [expStr, sig] = sigCookie.split('.');
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  let email: string;
  try {
    email = decodeURIComponent(rawEmail);
  } catch {
    return null;
  }

  try {
    const expected = Buffer.from(sign(email, role, exp));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  } catch {
    return null;
  }
  return { email, role };
}

/** 로그인 성공 후(서버 라우트에서만) 호출한다. */
export async function writeSession(email: string, role: SessionRole): Promise<void> {
  const store = await cookies();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const common = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // 현재 3505는 http로 서비스된다. HTTPS 리버스 프록시 뒤로 옮기면 COOKIE_SECURE=1.
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: MAX_AGE_SEC,
  };
  store.set(ROLE_COOKIE, role, common);
  store.set(EMAIL_COOKIE, encodeURIComponent(email), common);
  store.set(SIG_COOKIE, `${exp}.${sign(email, role, exp)}`, common);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ROLE_COOKIE);
  store.delete(EMAIL_COOKIE);
  store.delete(SIG_COOKIE);
}
