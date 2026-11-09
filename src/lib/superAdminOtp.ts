import { createHash, randomInt, timingSafeEqual } from 'crypto';

/**
 * 최고관리자 이메일 인증번호(OTP).
 *
 * - 수신자는 서버 설정(SUPER_ADMIN_EMAIL, 기본 ralfkang@outlook.com)으로 고정된다 —
 *   클라이언트가 수신 주소를 지정할 수 없다(임의 주소로 코드를 받아 로그인하는 경로 차단).
 * - 코드는 SHA-256 해시로만 보관, 10분 유효, 5회 오답 시 폐기, 재발송 60초 쿨다운.
 * - 저장소는 프로세스 메모리(Map) — app 컨테이너가 1개인 현재 배포 구성 기준.
 *   컨테이너가 재시작되면 발송된 코드는 무효가 되고 다시 받으면 된다.
 */

export const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

export function superAdminEmail(): string {
  return (process.env.SUPER_ADMIN_EMAIL || 'ralfkang@outlook.com').trim().toLowerCase();
}

interface PendingCode {
  hash: Buffer;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

const pending = new Map<string, PendingCode>();

function hashCode(code: string): Buffer {
  return createHash('sha256').update(code).digest();
}

export type IssueResult = { ok: true; code: string } | { ok: false; retryAfterSec: number };

export function issueCode(email: string): IssueResult {
  const now = Date.now();
  const existing = pending.get(email);
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000) };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  pending.set(email, { hash: hashCode(code), expiresAt: now + OTP_TTL_MIN * 60_000, sentAt: now, attempts: 0 });
  return { ok: true, code };
}

/** 메일 발송이 실패하면 쿨다운에 걸리지 않도록 발급 기록을 되돌린다. */
export function revokeCode(email: string): void {
  pending.delete(email);
}

export type VerifyResult = 'OK' | 'INVALID' | 'EXPIRED' | 'NO_CODE' | 'TOO_MANY_ATTEMPTS';

export function verifyCode(email: string, code: string): VerifyResult {
  const entry = pending.get(email);
  if (!entry) return 'NO_CODE';
  if (entry.expiresAt < Date.now()) {
    pending.delete(email);
    return 'EXPIRED';
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    pending.delete(email);
    return 'TOO_MANY_ATTEMPTS';
  }
  const ok = /^\d{6}$/.test(code) && timingSafeEqual(entry.hash, hashCode(code));
  if (!ok) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      pending.delete(email);
      return 'TOO_MANY_ATTEMPTS';
    }
    return 'INVALID';
  }
  pending.delete(email); // 1회용
  return 'OK';
}

/** ralfkang@outlook.com → ra*****@outlook.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
