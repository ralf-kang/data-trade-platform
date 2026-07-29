import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { isOwnerOrSuperAdmin, setFormLifecycle } from '@/lib/services/formService';

type Params = { params: Promise<{ formId: string }> };

/**
 * POST /api/forms/{formId}/publish   → 양식지 확정 (DRAFT → PUBLISHED)
 * body: { lifecycle: 'PUBLISHED' | 'DRAFT' }
 *
 * 확정하면 그 시점의 필드 구성이 외부 연동의 "계약"이 되고, API 쓰기가 열린다.
 * 다시 DRAFT로 되돌리면 외부 입력이 즉시 차단된다(설계 재작업 중 오적재 방지).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 확정 상태를 변경할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (body.lifecycle !== 'PUBLISHED' && body.lifecycle !== 'DRAFT') {
    return NextResponse.json({ error: 'lifecycle must be PUBLISHED or DRAFT' }, { status: 400 });
  }

  try {
    const form = await setFormLifecycle(formId, body.lifecycle, actor);
    return NextResponse.json({ form });
  } catch (err) {
    if (err instanceof Error && err.message === 'CONSENT_REQUIRED') {
      return NextResponse.json(
        {
          error: 'CONSENT_REQUIRED',
          message:
            '응답자 신원을 요구하는 양식지는 개인정보 동의서 컴포넌트 없이 확정할 수 없습니다. ' +
            '동의서 문항을 추가한 뒤 다시 확정해주세요.',
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
