import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getCurrentUser } from '@/lib/auth';
import { listFolderTree, createFolder, updateFolder, deleteFolder } from '@/lib/services/formTaxonomyService';

// 개인 폴더는 소유자 본인만 다룬다 — 모든 작업이 actor.id로 스코프된다.
// 슈퍼관리자라도 남의 폴더를 보거나 고치지 않는다(개인 작업공간이므로).

function errorResponse(err: unknown) {
  const code = err instanceof Error ? err.message : 'UNKNOWN';
  const messages: Record<string, string> = {
    EMPTY_NAME: '폴더 이름을 입력해주세요.',
    DUPLICATE_NAME: '같은 위치에 같은 이름의 폴더가 이미 있습니다.',
    SELF_PARENT: '자기 자신을 상위 폴더로 지정할 수 없습니다.',
    CYCLE: '하위 폴더를 상위로 지정할 수 없습니다(순환).',
    TOO_DEEP: '폴더는 4단계까지만 만들 수 있습니다.',
    HAS_CHILDREN: '하위 폴더가 있어 삭제할 수 없습니다.',
    NOT_FOUND: '대상을 찾을 수 없습니다.',
  };
  return NextResponse.json({ error: code, message: messages[code] ?? '처리에 실패했습니다.' }, { status: 400 });
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  return NextResponse.json({ tree: await listFolderTree(actor.id) });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  const { name, parentId } = await request.json();
  try {
    return NextResponse.json({ folder: await createFolder(actor.id, name, parentId ?? null) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  const { id, ...input } = await request.json();
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  try {
    return NextResponse.json({ folder: await updateFolder(actor.id, id, input) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  try {
    await deleteFolder(actor.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
