import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { revealMaskedField } from '@/lib/services/maskRevealService';

type Params = { params: Promise<{ formId: string; submissionId: string }> };

/**
 * 마스킹된 값 1건 열람 — 셀 단위 요청.
 * GET이 아니라 POST인 이유: 부수효과(감사 로그 기록)가 있고, 링크·프리페치·브라우저
 * 캐시로 의도치 않게 열람이 발생하면 안 되기 때문이다.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId, submissionId } = await params;
  const actor = await getCurrentAdmin();

  // 데이터 조회 권한이 먼저다 — 자격이 있어도 볼 수 없는 양식지가 있다.
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 제출 데이터를 조회할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const { fieldId } = await request.json();
  if (!fieldId) return NextResponse.json({ error: 'fieldId가 필요합니다.' }, { status: 400 });

  const result = await revealMaskedField(formId, submissionId, fieldId, actor);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, message: result.message },
      { status: result.reason === 'FORBIDDEN' ? 403 : 400 }
    );
  }
  return NextResponse.json({ value: result.value });
}
