import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getFormTemplate } from '@/lib/elasticsearch';
import { canAccessFormData } from '@/lib/services/formService';
import { BelowThresholdError, getAnonAggregation } from '@/lib/services/anonymityService';

type Params = { params: Promise<{ formId: string }> };

/**
 * 익명 문항 집계 조회.
 *
 * 개별 응답을 반환하는 엔드포인트는 **의도적으로 존재하지 않는다** — 양식 소유자도,
 * 플랫폼 관리자도 익명 문항의 개별 응답은 볼 수 없다. 관리자에게 예외를 두면
 * "익명"이라는 약속이 신뢰의 근거가 되지 못하기 때문이다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 데이터에 접근할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const fieldId = request.nextUrl.searchParams.get('fieldId');
  if (!fieldId) return NextResponse.json({ error: 'fieldId is required' }, { status: 400 });

  const template = await getFormTemplate(formId);
  const field = template?.fields.find((f) => f.id === fieldId);
  if (!field) return NextResponse.json({ error: 'FIELD_NOT_FOUND' }, { status: 404 });
  if (!field.anonymous) {
    return NextResponse.json(
      { error: 'NOT_ANONYMOUS', message: '익명 문항이 아닙니다. 일반 데이터 조회를 사용하세요.' },
      { status: 400 }
    );
  }

  try {
    const result = await getAnonAggregation(formId, field);
    return NextResponse.json({ fieldId, label: field.label, ...result });
  } catch (err) {
    if (err instanceof BelowThresholdError) {
      // 현재 건수는 알려주지 않는다 — 조건을 바꿔가며 건수 변화를 관찰하면
      // 특정 인물의 응답 여부를 역추적할 수 있다.
      return NextResponse.json(
        {
          error: 'BELOW_ANONYMITY_THRESHOLD',
          message: '응답 수가 적어 개인이 특정될 수 있으므로 결과를 제공하지 않습니다.',
          required: err.required,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
