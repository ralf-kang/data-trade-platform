import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, getCurrentUser } from '@/lib/auth';
import { listCategoryTree, createCategory, updateCategory, deleteCategory } from '@/lib/services/formTaxonomyService';
import { logAudit } from '@/lib/services/auditService';

// 산업분야 분류는 전사 공통 어휘이므로 편집은 슈퍼관리자 전용이다.
// (조회는 /api/forms/taxonomy에서 일반 관리자에게도 열어 준다 — 배지·필터에 필요하다.)

function errorResponse(err: unknown) {
  const code = err instanceof Error ? err.message : 'UNKNOWN';
  const messages: Record<string, string> = {
    EMPTY_NAME: '이름을 입력해주세요.',
    DUPLICATE_NAME: '같은 상위 분류 안에 같은 이름이 이미 있습니다.',
    SELF_PARENT: '자기 자신을 상위로 지정할 수 없습니다.',
    CYCLE: '하위 분류를 상위로 지정할 수 없습니다(순환).',
    TOO_DEEP: '분류는 4단계까지만 만들 수 있습니다.',
    HAS_CHILDREN: '하위 분류가 있어 삭제할 수 없습니다. 하위를 먼저 정리해주세요.',
    NOT_FOUND: '대상을 찾을 수 없습니다.',
  };
  return NextResponse.json({ error: code, message: messages[code] ?? '처리에 실패했습니다.' }, { status: 400 });
}

export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;
  return NextResponse.json({ tree: await listCategoryTree() });
}

export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;
  const { name, parentId } = await request.json();
  const actor = await getCurrentUser();
  try {
    const created = await createCategory(name, parentId ?? null);
    await logAudit({
      userEmail: actor.email,
      action: 'FORM_CATEGORY_CREATE',
      target: `FormCategory [${created.id}]`,
      details: `산업분야 분류 생성: ${created.name}`,
      severity: 'info',
    });
    return NextResponse.json({ category: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;
  const { id, ...input } = await request.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  try {
    return NextResponse.json({ category: await updateCategory(id, input) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  const actor = await getCurrentUser();
  try {
    await deleteCategory(id);
    await logAudit({
      userEmail: actor.email,
      action: 'FORM_CATEGORY_DELETE',
      target: `FormCategory [${id}]`,
      details: '산업분야 분류 삭제',
      severity: 'warning',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
