import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireSuperAdmin } from '@/lib/auth';
import { deleteAdminUser, updateAdminUser } from '@/lib/services/adminUserService';

type Params = { params: Promise<{ id: string }> };

// 슈퍼관리자는 관리자의 이름/이메일/소속/역할(승격·강등)/정지/대량추출 허용 여부 등
// 모든 속성을 수정할 수 있다.
export async function PATCH(request: NextRequest, { params }: Params) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await request.json();
  const actor = await getCurrentAdmin();

  try {
    const updated = await updateAdminUser(
      id,
      {
        name: body.name,
        email: body.email,
        department: body.department,
        position: body.position,
        roles: body.roles,
        status: body.status,
        canBulkExport: body.canBulkExport,
      },
      actor
    );
    return NextResponse.json({ user: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 계정 삭제 — 반드시 ?reassignOwnerId=<다른 관리자 id 또는 슈퍼관리자 자신의 id> 를 지정해
// 소유 양식지가 임자 없이 남지 않도록 한다.
export async function DELETE(request: NextRequest, { params }: Params) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const reassignOwnerId = request.nextUrl.searchParams.get('reassignOwnerId');
  if (!reassignOwnerId) {
    return NextResponse.json(
      { error: 'reassignOwnerId is required (양식지 소유권을 위임할 대상)' },
      { status: 400 }
    );
  }

  const actor = await getCurrentAdmin();
  try {
    const result = await deleteAdminUser(id, reassignOwnerId, actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
