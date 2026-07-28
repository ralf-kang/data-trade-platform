import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import type { AdminUser } from '@/generated/prisma/client';

export async function listAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { formsOwned: true } } },
  });
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  orgName?: string | null;
  role?: 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
  canBulkExport?: boolean;
}

/** 슈퍼관리자는 관리자의 모든 속성(이름/이메일/소속/역할/정지여부/대량추출허용)을 수정할 수 있다. */
export async function updateAdminUser(
  id: string,
  input: UpdateAdminUserInput,
  actor: AdminUser
): Promise<AdminUser> {
  const before = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.adminUser.update({ where: { id }, data: input });

  const changes: string[] = [];
  if (input.role && input.role !== before.role) {
    changes.push(input.role === 'SUPER_ADMIN' ? '슈퍼관리자로 승격' : '일반 관리자로 강등');
  }
  if (input.isActive !== undefined && input.isActive !== before.isActive) {
    changes.push(input.isActive ? '계정 활성화' : '계정 정지(제재)');
  }
  if (input.canBulkExport !== undefined && input.canBulkExport !== before.canBulkExport) {
    changes.push(input.canBulkExport ? '대량 추출 허용' : '대량 추출 제한');
  }
  if (changes.length === 0) changes.push('속성 수정');

  await logAudit({
    userEmail: actor.email,
    action: 'ADMIN_USER_UPDATE',
    target: `AdminUser [${updated.email}]`,
    details: changes.join(', '),
    severity: changes.some((c) => c.includes('정지') || c.includes('제한')) ? 'warning' : 'info',
  });

  return updated;
}

export interface DeleteAdminUserResult {
  reassignedFormCount: number;
}

/**
 * 관리자 계정 삭제. 소유하고 있던 양식지는 반드시 다른 관리자에게 위임하거나
 * 슈퍼관리자 자신에게 귀속시켜야 한다 (소유자 없는 양식지가 남지 않도록 강제).
 */
export async function deleteAdminUser(
  id: string,
  reassignOwnerId: string,
  actor: AdminUser
): Promise<DeleteAdminUserResult> {
  if (id === actor.id) throw new Error('CANNOT_DELETE_SELF');

  const target = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  const reassignTarget = await prisma.adminUser.findUniqueOrThrow({ where: { id: reassignOwnerId } });

  const ownedForms = await prisma.formRegistry.findMany({ where: { ownerId: id }, select: { id: true } });

  await prisma.$transaction([
    prisma.formRegistry.updateMany({ where: { ownerId: id }, data: { ownerId: reassignOwnerId } }),
    prisma.shareRequest.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
    prisma.adminNotification.deleteMany({ where: { userId: id } }),
    prisma.adminUser.delete({ where: { id } }),
  ]);

  await logAudit({
    userEmail: actor.email,
    action: 'ADMIN_USER_DELETE',
    target: `AdminUser [${target.email}]`,
    details: `계정 삭제, 소유 양식지 ${ownedForms.length}건을 [${reassignTarget.email}]에게 위임`,
    severity: 'warning',
  });

  return { reassignedFormCount: ownedForms.length };
}
