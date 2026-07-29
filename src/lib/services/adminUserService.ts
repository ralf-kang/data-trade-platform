import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import type { ActingUser } from '@/lib/auth';
import type { RoleType, User } from '@/generated/prisma/client';

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      roles: true,
      _count: { select: { formsOwned: true } },
    },
  });
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  department?: string | null;
  position?: string | null;
  /** 전역 역할을 이 목록으로 교체한다(양식 단위 위임은 건드리지 않음). */
  roles?: RoleType[];
  status?: 'ACTIVE' | 'SUSPENDED' | 'LEFT';
  canBulkExport?: boolean;
}

/**
 * 슈퍼관리자는 사용자의 속성과 전역 역할을 수정할 수 있다.
 *
 * 역할은 별도 테이블(UserRole)이므로, roles가 주어지면 전역 역할만 교체한다 —
 * 양식 단위로 위임된 권한(scopeFormId != null)은 담당자 인수인계 맥락이 따로 있으므로
 * 여기서 함께 지우지 않는다.
 */
export async function updateAdminUser(
  id: string,
  input: UpdateAdminUserInput,
  actor: ActingUser
): Promise<User> {
  const before = await prisma.user.findUniqueOrThrow({ where: { id }, include: { roles: true } });
  const { roles, ...scalars } = input;

  const updated = await prisma.user.update({ where: { id }, data: scalars });

  const changes: string[] = [];

  if (roles) {
    const beforeGlobal = before.roles.filter((r) => r.scopeFormId === null).map((r) => r.role);
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id, scopeFormId: null } }),
      prisma.userRole.createMany({
        data: roles.map((role) => ({ userId: id, role, grantedBy: actor.email })),
      }),
    ]);
    const added = roles.filter((r) => !beforeGlobal.includes(r));
    const removed = beforeGlobal.filter((r) => !roles.includes(r));
    if (added.length) changes.push(`역할 부여: ${added.join(', ')}`);
    if (removed.length) changes.push(`역할 회수: ${removed.join(', ')}`);
  }

  if (input.status && input.status !== before.status) {
    changes.push(
      input.status === 'SUSPENDED'
        ? '계정 정지(제재)'
        : input.status === 'LEFT'
          ? '퇴사/이탈 처리'
          : '계정 활성화'
    );
  }
  if (input.canBulkExport !== undefined && input.canBulkExport !== before.canBulkExport) {
    changes.push(input.canBulkExport ? '대량 추출 허용' : '대량 추출 제한');
  }
  if (changes.length === 0) changes.push('속성 수정');

  await logAudit({
    userEmail: actor.email,
    action: 'ADMIN_USER_UPDATE',
    target: `User [${updated.email}]`,
    details: changes.join(', '),
    severity: changes.some((c) => c.includes('정지') || c.includes('제한') || c.includes('역할'))
      ? 'warning'
      : 'info',
  });

  return updated;
}

export interface DeleteAdminUserResult {
  reassignedFormCount: number;
}

/**
 * 사용자 계정 삭제. 소유하고 있던 양식지는 반드시 다른 관리자에게 위임하거나
 * 슈퍼관리자 자신에게 귀속시켜야 한다 (소유자 없는 양식지가 남지 않도록 강제).
 *
 * NOTE: LDAP 동기화 계정은 삭제 대신 status=LEFT를 권한다 — 삭제해도 다음 동기화에서
 * 다시 생성되고, 과거 응답 이력과의 연결이 끊긴다.
 */
export async function deleteAdminUser(
  id: string,
  reassignOwnerId: string,
  actor: ActingUser
): Promise<DeleteAdminUserResult> {
  if (id === actor.id) throw new Error('CANNOT_DELETE_SELF');

  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  const reassignTarget = await prisma.user.findUniqueOrThrow({ where: { id: reassignOwnerId } });

  const ownedForms = await prisma.formRegistry.findMany({ where: { ownerId: id }, select: { id: true } });

  await prisma.$transaction([
    prisma.formRegistry.updateMany({ where: { ownerId: id }, data: { ownerId: reassignOwnerId } }),
    prisma.shareRequest.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } }),
    prisma.adminNotification.deleteMany({ where: { userId: id } }),
    // UserRole은 onDelete: Cascade로 함께 삭제된다.
    prisma.user.delete({ where: { id } }),
  ]);

  await logAudit({
    userEmail: actor.email,
    action: 'ADMIN_USER_DELETE',
    target: `User [${target.email}]`,
    details: `계정 삭제, 소유 양식지 ${ownedForms.length}건을 [${reassignTarget.email}]에게 위임`,
    severity: 'warning',
  });

  return { reassignedFormCount: ownedForms.length };
}
