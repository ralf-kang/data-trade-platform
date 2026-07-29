import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isPlatformAdmin, requireAdmin } from '@/lib/auth';
import {
  changeFormOwner,
  deleteForm,
  getForm,
  incrementFormView,
  isOwnerOrSuperAdmin,
  setFormActivePeriod,
  setFormStatus,
  updateForm,
} from '@/lib/services/formService';

type Params = { params: Promise<{ formId: string }> };

// GET은 의도적으로 인증을 요구하지 않는다 — 공개 응답 페이지(/q/[formId])가 폼 필드
// 구성을 렌더링하기 위해 비로그인 상태에서도 호출해야 하기 때문이다. 실제 보호 대상인
// "제출 데이터"는 이 엔드포인트가 아니라 아래 submissions 라우트에서 노출되며, 그쪽은
// requireAdmin() + canAccessFormData()로 보호된다.
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
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 편집할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json();
  try {
    const form = await updateForm(
      formId,
      { title: body.title, description: body.description, fields: body.fields },
      actor
    );
    if (!form) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ form });
  } catch (err) {
    if (err instanceof Error && err.message === 'ANONYMITY_LOCKED') {
      return NextResponse.json(
        {
          error: 'ANONYMITY_LOCKED',
          message:
            '확정된 양식지의 익명 설정은 변경할 수 없습니다. 이미 응답한 분들과의 약속이기 때문입니다. ' +
            '설정을 바꾸려면 양식지를 새로 만들어 주세요.',
        },
        { status: 409 }
      );
    }
    throw err;
  }
}

// 여러 운영 속성을 한 번에 다룬다:
//   - status: 배포 오픈/마감 (소유자 또는 슈퍼관리자)
//   - startsAt/expiresAt: 활성화 기간 (소유자 또는 슈퍼관리자)
//   - ownerId: 소유권 이전 (슈퍼관리자 전용)
export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const body = await request.json();
  const actor = await getCurrentUser();

  if (body.ownerId !== undefined) {
    if (!isPlatformAdmin(actor)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: '소유권 이전은 슈퍼관리자만 가능합니다.' }, { status: 403 });
    }
    try {
      await changeFormOwner(formId, body.ownerId, actor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ownership transfer failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (body.status !== undefined || body.startsAt !== undefined || body.expiresAt !== undefined) {
    if (!(await isOwnerOrSuperAdmin(formId, actor))) {
      return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 설정을 변경할 수 있습니다.' }, { status: 403 });
    }
  }

  if (body.status !== undefined) {
    if (body.status !== 'OPEN' && body.status !== 'CLOSED') {
      return NextResponse.json({ error: 'status must be OPEN or CLOSED' }, { status: 400 });
    }
    await setFormStatus(formId, body.status, actor);
  }

  if (body.startsAt !== undefined || body.expiresAt !== undefined) {
    await setFormActivePeriod(
      formId,
      body.startsAt ? new Date(body.startsAt) : null,
      body.expiresAt ? new Date(body.expiresAt) : null,
      actor
    );
  }

  const form = await getForm(formId);
  return NextResponse.json({ form });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 삭제할 수 있습니다.' }, { status: 403 });
  }

  await deleteForm(formId, actor);
  return NextResponse.json({ ok: true });
}
