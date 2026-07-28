import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { deleteForm, getForm, incrementFormView, setFormStatus, updateForm } from '@/lib/services/formService';

type Params = { params: Promise<{ formId: string }> };

// GET은 의도적으로 인증을 요구하지 않는다 — 공개 응답 페이지(/q/[formId])가 폼 필드
// 구성을 렌더링하기 위해 비로그인 상태에서도 호출해야 하기 때문이다. 실제 보호 대상인
// "제출 데이터"는 이 엔드포인트가 아니라 아래 submissions 라우트에서 노출되며, 그쪽은
// requireAdmin()으로 보호된다.
export async function GET(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 공개 응답 페이지(/q/[id])에서 넘어온 조회일 때만 조회수를 카운트한다.
  if (request.nextUrl.searchParams.get('countView') === '1') {
    await incrementFormView(formId);
  }
  return NextResponse.json({ form });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const body = await request.json();
  const actor = await getCurrentAdmin();
  const form = await updateForm(
    formId,
    { title: body.title, description: body.description, fields: body.fields },
    actor
  );
  if (!form) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ form });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const body = await request.json();
  if (body.status !== 'OPEN' && body.status !== 'CLOSED') {
    return NextResponse.json({ error: 'status must be OPEN or CLOSED' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  await setFormStatus(formId, body.status, actor);
  const form = await getForm(formId);
  return NextResponse.json({ form });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  await deleteForm(formId, actor);
  return NextResponse.json({ ok: true });
}
