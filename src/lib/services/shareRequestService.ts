import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import type { AdminUser } from '@/generated/prisma/client';

const withUsers = {
  fromUser: { select: { id: true, name: true, email: true } },
  toUser: { select: { id: true, name: true, email: true } },
  form: { select: { id: true } },
} as const;

export async function listShareRequests(userId: string) {
  const [received, sent] = await Promise.all([
    prisma.shareRequest.findMany({
      where: { toUserId: userId },
      include: withUsers,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shareRequest.findMany({
      where: { fromUserId: userId },
      include: withUsers,
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { received, sent };
}

export async function createShareRequest(formId: string, requester: AdminUser) {
  const form = await prisma.formRegistry.findUnique({
    where: { id: formId },
    select: { ownerId: true },
  });
  if (!form?.ownerId) throw new Error('FORM_OWNER_NOT_FOUND');
  if (form.ownerId === requester.id) throw new Error('CANNOT_REQUEST_OWN_FORM');

  return prisma.shareRequest.create({
    data: { formId, fromUserId: requester.id, toUserId: form.ownerId },
    include: withUsers,
  });
}

/**
 * 소유자(또는 슈퍼관리자)가 승인 대기 없이 곧바로 다른 관리자에게 제출 데이터 조회
 * 권한을 부여한다 — URL 관리 화면의 "설정 > 공유/이관" 기능에서 사용.
 */
export async function createDirectShare(formId: string, granteeUserId: string, actor: AdminUser) {
  const form = await prisma.formRegistry.findUnique({ where: { id: formId }, select: { ownerId: true } });
  if (!form?.ownerId) throw new Error('FORM_OWNER_NOT_FOUND');
  if (actor.role !== 'SUPER_ADMIN' && actor.id !== form.ownerId) throw new Error('FORBIDDEN');
  if (granteeUserId === form.ownerId) throw new Error('CANNOT_SHARE_WITH_OWNER');

  const created = await prisma.shareRequest.create({
    data: { formId, fromUserId: granteeUserId, toUserId: form.ownerId, status: 'APPROVED' },
    include: withUsers,
  });

  await logAudit({
    userEmail: actor.email,
    action: 'SHARE_REQUEST_UPDATE',
    target: `ShareRequest [${created.id}]`,
    details: `소유자가 [${created.fromUser.email}]에게 제출 데이터 조회 권한을 직접 부여`,
    formId,
  });

  return created;
}

export async function updateShareRequestStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  actor: AdminUser
) {
  const request = await prisma.shareRequest.update({
    where: { id },
    data: { status },
    include: withUsers,
  });

  await logAudit({
    userEmail: actor.email,
    action: 'SHARE_REQUEST_UPDATE',
    target: `ShareRequest [${id}]`,
    details: status === 'APPROVED' ? '공유 요청 승인' : '공유 요청 거절',
    formId: request.formId,
  });

  return request;
}
