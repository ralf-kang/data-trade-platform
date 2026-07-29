import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import type { ActingUser } from '@/lib/auth';
import type { AuthorAuthorization, AuthorAuthStatus } from '@/generated/prisma/client';

/**
 * 개인정보 취급자(제작 자격) 심사 — 역할(UserRole.AUTHOR)과 별개의 절차.
 *
 * AUTHOR 역할은 "양식을 만들 수 있다"는 기능 권한일 뿐이다. 양식 제작자는 수집 항목을
 * 정하고 응답 데이터를 열람·추출할 수 있어 사실상 개인정보 취급자가 되므로, 목적·서약·
 * 교육을 요구하는 별도 자격을 둔다. LDAP defaultRole은 MEMBER로 유지되므로(동기화로
 * AUTHOR가 자동 부여되지 않음), 자격은 반드시 신청 → 슈퍼관리자 승인을 거친다.
 *
 * 기본 기간(조정 가능): 교육 유효기간 12개월, 재승인 주기 24개월.
 */

const TRAINING_VALID_MONTHS = 12;
const REAUTHORIZE_MONTHS = 24;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * 저장된 상태를 현재 시각 기준으로 갱신한다(지연 전이).
 *
 * 교육 유효기간이 지났는데도 DB에는 APPROVED로 남아 있으면 신규 제작이 계속
 * 허용되므로, 읽을 때마다 만료 여부를 확인해 필요하면 상태를 갱신한다.
 * SUSPENDED는 신규 제작·배포만 막고 기존 데이터 조회는 유지해야 하므로(§본문 참고),
 * 이 함수는 상태값만 바꿀 뿐 다른 권한을 건드리지 않는다.
 */
export async function syncAuthorAuthExpiry(auth: AuthorAuthorization): Promise<AuthorAuthorization> {
  if (auth.status !== 'APPROVED') return auth;

  const now = new Date();
  let nextStatus: AuthorAuthStatus | null = null;

  if (auth.reauthorizeBy && auth.reauthorizeBy < now) {
    nextStatus = 'EXPIRED';
  } else if (auth.trainingValidUntil && auth.trainingValidUntil < now) {
    nextStatus = 'SUSPENDED';
  }

  if (!nextStatus) return auth;

  return prisma.authorAuthorization.update({
    where: { userId: auth.userId },
    data: { status: nextStatus },
  });
}

export async function getAuthorAuthorization(userId: string): Promise<AuthorAuthorization | null> {
  const auth = await prisma.authorAuthorization.findUnique({ where: { userId } });
  if (!auth) return null;
  return syncAuthorAuthExpiry(auth);
}

/** 신규 제작·배포가 가능한 상태인지. */
export async function canCreateOrPublish(userId: string): Promise<boolean> {
  const auth = await getAuthorAuthorization(userId);
  return auth?.status === 'APPROVED';
}

// ---------------------------------------------------------------------------
// 신청 (임직원)
// ---------------------------------------------------------------------------

export async function applyForAuthorAuthorization(
  actor: ActingUser,
  input: { purpose: string; plannedDataItems: string }
): Promise<AuthorAuthorization> {
  const existing = await prisma.authorAuthorization.findUnique({ where: { userId: actor.id } });
  if (existing && !['REVOKED', 'EXPIRED'].includes(existing.status)) {
    throw new Error('ALREADY_APPLIED');
  }

  const auth = await prisma.authorAuthorization.upsert({
    where: { userId: actor.id },
    update: {
      status: 'PENDING',
      purpose: input.purpose,
      plannedDataItems: input.plannedDataItems,
      requestedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      revokedReason: null,
    },
    create: {
      userId: actor.id,
      purpose: input.purpose,
      plannedDataItems: input.plannedDataItems,
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'AUTHOR_AUTH_APPLY',
    target: `User [${actor.email}]`,
    details: `개인정보 취급자(제작 자격) 신청 — 목적: ${input.purpose}`,
    severity: 'info',
  });
  return auth;
}

// ---------------------------------------------------------------------------
// 심사 (슈퍼관리자)
// ---------------------------------------------------------------------------

export async function approveAuthorAuthorization(
  userId: string,
  actor: ActingUser
): Promise<AuthorAuthorization> {
  const now = new Date();
  const auth = await prisma.authorAuthorization.update({
    where: { userId },
    data: {
      status: 'APPROVED',
      pledgeAcceptedAt: now,
      trainingCompletedAt: now,
      trainingValidUntil: addMonths(now, TRAINING_VALID_MONTHS),
      reauthorizeBy: addMonths(now, REAUTHORIZE_MONTHS),
      reviewedBy: actor.email,
      reviewedAt: now,
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'AUTHOR_AUTH_APPROVE',
    target: `User [${userId}]`,
    details: `개인정보 취급자 자격 승인 (교육유효기간 ${TRAINING_VALID_MONTHS}개월, 재승인주기 ${REAUTHORIZE_MONTHS}개월)`,
    severity: 'warning',
  });
  return auth;
}

export async function rejectAuthorAuthorization(
  userId: string,
  reason: string,
  actor: ActingUser
): Promise<AuthorAuthorization> {
  const auth = await prisma.authorAuthorization.update({
    where: { userId },
    data: { status: 'REVOKED', revokedReason: reason, reviewedBy: actor.email, reviewedAt: new Date() },
  });
  await logAudit({
    userEmail: actor.email,
    action: 'AUTHOR_AUTH_REJECT',
    target: `User [${userId}]`,
    details: `개인정보 취급자 자격 신청 거부 — ${reason}`,
    severity: 'warning',
  });
  return auth;
}

/** 해제 — 퇴사·직무변경·위반. 승인된 자격을 되돌린다. */
export async function revokeAuthorAuthorization(
  userId: string,
  reason: string,
  actor: ActingUser
): Promise<AuthorAuthorization> {
  const auth = await prisma.authorAuthorization.update({
    where: { userId },
    data: { status: 'REVOKED', revokedReason: reason, reviewedBy: actor.email, reviewedAt: new Date() },
  });
  await logAudit({
    userEmail: actor.email,
    action: 'AUTHOR_AUTH_REVOKE',
    target: `User [${userId}]`,
    details: `개인정보 취급자 자격 해제 — ${reason}`,
    severity: 'critical',
  });
  return auth;
}

export async function listAuthorAuthorizations() {
  const rows = await prisma.authorAuthorization.findMany({
    include: { user: { select: { id: true, name: true, email: true, department: true } } },
    orderBy: { requestedAt: 'desc' },
  });
  // 목록 조회 시점에도 만료 지연 전이를 적용해 화면이 실제 상태를 반영하게 한다.
  return Promise.all(rows.map(async (r) => ({ ...(await syncAuthorAuthExpiry(r)), user: r.user })));
}
