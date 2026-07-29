import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isPlatformAdmin, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';

// 클라이언트 컴포넌트가 "현재 로그인한 관리자가 누구인지(소유자 여부 비교 등)"를
// 알아야 할 때 사용하는 경량 엔드포인트.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  return NextResponse.json({
    id: actor.id,
    email: actor.email,
    name: actor.name,
    department: actor.department,
    position: actor.position,
    employeeNo: actor.employeeNo,
    source: actor.source,
    roles: actor.roles.filter((r) => r.scopeFormId === null).map((r) => r.role),
    isPlatformAdmin: isPlatformAdmin(actor),
    canBulkExport: actor.canBulkExport,
  });
}

/**
 * 본인 프로필 수정. 이름·부서·직위만 허용한다 —
 *   - email: 계정 식별자이자 감사 로그의 주체 키이므로 본인이 바꿀 수 없다.
 *   - roles/canBulkExport: 권한이므로 슈퍼관리자만(별도 화면) 변경한다.
 *   - employeeNo: 인사 연동 키라 본인이 임의로 바꾸면 동일인 추적이 깨진다.
 * LDAP 계정은 원격이 원본이므로 수정을 막는다 — 여기서 고쳐봐야 다음 동기화에 덮어써진다.
 */
export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  if (actor.source === 'LDAP') {
    return NextResponse.json(
      {
        error: 'LDAP_MANAGED',
        message: 'LDAP으로 동기화되는 계정입니다. 이름·부서 변경은 인사시스템에서 처리해주세요.',
      },
      { status: 409 }
    );
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (name !== undefined && name.length === 0) {
    return NextResponse.json({ error: 'NAME_REQUIRED', message: '이름을 입력해주세요.' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: {
      ...(name !== undefined && { name }),
      ...(body.department !== undefined && { department: body.department || null }),
      ...(body.position !== undefined && { position: body.position || null }),
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'PROFILE_UPDATE',
    target: `User [${actor.email}]`,
    details: '본인 프로필(이름/부서/직위) 수정',
    severity: 'info',
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    department: updated.department,
    position: updated.position,
  });
}
