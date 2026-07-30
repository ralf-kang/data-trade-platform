import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import type { IdentityMode, User } from '@/generated/prisma/client';

/**
 * 응답자 신원(1단계) — "로그인 없이"와 "누군지 안다"를 양립시키는 계층.
 *
 * 흐름:
 *   1. 관리자가 대상자에게 개인화 링크(/q/{formId}?t=...)를 발급·전달
 *   2. 응답자가 클릭하면 서버가 토큰을 검증하고 즉시 "응답 세션 쿠키"로 교환
 *   3. 302 리다이렉트로 URL에서 토큰을 제거 (히스토리·Referer·액세스 로그 유출 차단)
 *   4. 이후 요청은 쿠키로 신원 확인
 *
 * 쿠키에는 토큰 원문이 아니라 해시를 담는다 — 쿠키가 새어도 DB 대조 없이는 무의미하고,
 * 폐기(revoke)가 즉시 반영된다.
 */

const TOKEN_PREFIX = 'wrt_'; // web-report-token — API 키(wre_)와 접두로 구분
const COOKIE_PREFIX = 'respondent_'; // respondent_{formId} = tokenHash

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// 발급/폐기 (관리자용)
// ---------------------------------------------------------------------------

export interface IssueTokensResult {
  issued: Array<{ userId: string; email: string; link: string; tokenId: string }>;
  skipped: Array<{ userId: string; reason: string }>;
}

/**
 * 대상자들에게 개인화 링크를 일괄 발급한다.
 * 원문 토큰은 이 반환값에만 존재한다 — DB에는 해시만 저장되므로 다시 조회할 수 없다.
 * 이미 유효한 토큰이 있는 사용자는 건너뛴다(재발급은 revoke 후 다시 발급).
 */
export async function issueTokens(
  formId: string,
  userIds: string[],
  opts: { expiresAt: Date; singleUse?: boolean; issuedBy: string; baseUrl: string; campaignId?: string }
): Promise<IssueTokensResult> {
  const result: IssueTokensResult = { issued: [], skipped: [] };

  for (const userId of userIds) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      result.skipped.push({ userId, reason: '사용자 없음' });
      continue;
    }
    if (user.status !== 'ACTIVE') {
      result.skipped.push({ userId, reason: `비활성 계정(${user.status})` });
      continue;
    }
    // 중복 발급 방지는 회차 단위로 판단한다. 양식 단위로 보면 1회차 링크가 살아 있는
    // 동안 2회차 링크를 못 받아, 반복 수집에서 아무도 다음 회차에 응답할 수 없게 된다.
    const existing = await prisma.respondentToken.findFirst({
      where: {
        userId,
        formId,
        campaignId: opts.campaignId ?? null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      result.skipped.push({ userId, reason: '이 회차의 유효한 링크가 이미 있음' });
      continue;
    }

    const raw = `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`;
    const token = await prisma.respondentToken.create({
      data: {
        tokenHash: hashToken(raw),
        tokenPrefix: raw.slice(0, 12),
        userId,
        formId,
        campaignId: opts.campaignId ?? null,
        expiresAt: opts.expiresAt,
        singleUse: opts.singleUse ?? false,
        issuedBy: opts.issuedBy,
      },
    });
    result.issued.push({
      userId,
      email: user.email,
      // 교환 전용 경로로 보낸다 — 토큰을 쿠키로 바꾼 뒤 즉시 /q/{formId}로 리다이렉트된다.
      link: `${opts.baseUrl}/q/${formId}/enter?t=${raw}`,
      tokenId: token.id,
    });
  }
  return result;
}

export async function revokeToken(tokenId: string): Promise<void> {
  await prisma.respondentToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// 검증/교환 (응답 화면용)
// ---------------------------------------------------------------------------

export interface RespondentIdentity {
  level: 'ANONYMOUS' | 'IDENTIFIED' | 'AUTHENTICATED';
  user: User | null;
  tokenId: string | null;
  /** 링크가 특정 회차용으로 발급되었으면 그 회차 — 제출이 이 회차로 귀속된다(3단계). */
  campaignId: string | null;
}

const ANONYMOUS: RespondentIdentity = {
  level: 'ANONYMOUS',
  user: null,
  tokenId: null,
  campaignId: null,
};

/** 응답 세션 쿠키 이름 — Route Handler가 직접 심을 수 있도록 노출한다. */
export function respondentCookieName(formId: string): string {
  return `${COOKIE_PREFIX}${formId}`;
}

export interface VerifiedToken {
  tokenHash: string;
  expiresAt: Date;
}

/**
 * URL 토큰을 검증한다. 쿠키를 여기서 심지 않는 이유:
 * Next.js는 서버 컴포넌트 렌더링 중 쿠키 변경을 허용하지 않는다(Route Handler 또는
 * Server Function에서만 가능). 그래서 검증만 하고, 실제 Set-Cookie는 호출부인
 * /q/[id]/enter Route Handler가 리다이렉트 응답에 실어 보낸다.
 */
export async function verifyToken(formId: string, rawToken: string): Promise<VerifiedToken | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;

  const token = await prisma.respondentToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!token || token.formId !== formId) return null;
  if (token.revokedAt || token.expiresAt.getTime() < Date.now()) return null;
  if (token.singleUse && token.usedAt) return null;

  // 열람 시점 기록 (최초 1회) — 응답률 진단용
  if (!token.openedAt) {
    await prisma.respondentToken
      .update({ where: { id: token.id }, data: { openedAt: new Date() } })
      .catch(() => undefined);
  }

  return { tokenHash: token.tokenHash, expiresAt: token.expiresAt };
}

/**
 * 현재 요청의 응답자 신원을 해석한다.
 * 우선순위: 플랫폼 로그인 세션(AUTHENTICATED) → 응답 세션 쿠키(IDENTIFIED) → 없음(ANONYMOUS).
 *
 * 로그인 세션을 개인화 링크보다 먼저 보는 이유: 로그인은 본인이 직접 자격을 증명한
 * 것이고, 개인화 링크는 그 링크를 쥔 사람이 본인이라는 "약한" 가정에 의존한다 —
 * 신뢰도가 더 높은 쪽을 우선한다.
 */
export async function resolveRespondent(formId: string): Promise<RespondentIdentity> {
  // 익명(ANONYMOUS) 양식지는 어떤 세션·쿠키가 있어도 신원을 절대 엮지 않는다 — 같은
  // 브라우저로 관리자 포털에 로그인해 둔 상태로 익명 설문에 들어와도(흔한 상황이다)
  // 신원이 새어 들어가면 안 된다. 이 검사가 다른 모든 신원 해석보다 우선한다.
  const registry = await prisma.formRegistry.findUnique({ where: { id: formId }, select: { identityMode: true } });
  if (registry?.identityMode === 'ANONYMOUS') return ANONYMOUS;

  const store = await cookies();

  // 플랫폼 로그인 세션(src/lib/auth.ts의 adminRole/adminEmail 쿠키 브릿지) — 계정을
  // 새로 만들지는 않는다. 없는 이메일이면 로그인 상태가 아닌 것과 같이 취급한다.
  const rawEmail = store.get('adminEmail')?.value;
  if (rawEmail) {
    const email = decodeURIComponent(rawEmail);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status === 'ACTIVE') {
      return { level: 'AUTHENTICATED', user, tokenId: null, campaignId: null };
    }
  }

  const cookieHash = store.get(`${COOKIE_PREFIX}${formId}`)?.value;
  if (!cookieHash) return ANONYMOUS;

  const token = await prisma.respondentToken.findUnique({
    where: { tokenHash: cookieHash },
    include: { user: true },
  });
  // 쿠키가 있어도 토큰이 폐기/만료됐으면 익명으로 강등 — revoke가 즉시 효력을 가진다.
  if (!token || token.formId !== formId) return ANONYMOUS;
  if (token.revokedAt || token.expiresAt.getTime() < Date.now()) return ANONYMOUS;
  if (token.user.status !== 'ACTIVE') return ANONYMOUS;

  return { level: 'IDENTIFIED', user: token.user, tokenId: token.id, campaignId: token.campaignId };
}

/**
 * 양식의 identityMode 요건을 이 신원이 충족하는지.
 * 미충족 시 응답 페이지/제출 API가 거부해야 한다.
 */
export function satisfiesIdentityMode(mode: IdentityMode, identity: RespondentIdentity): boolean {
  switch (mode) {
    case 'IDENTIFIED':
      return identity.level === 'IDENTIFIED' || identity.level === 'AUTHENTICATED';
    case 'AUTHENTICATED':
      return identity.level === 'AUTHENTICATED';
    default:
      return true; // ANONYMOUS / MIXED — 익명 허용, 신원이 있으면 있는 대로 기록
  }
}

/** 제출 완료 시 singleUse 토큰 소진 처리. */
export async function markTokenUsed(tokenId: string): Promise<void> {
  await prisma.respondentToken
    .update({ where: { id: tokenId }, data: { usedAt: new Date() } })
    .catch(() => undefined);
}
