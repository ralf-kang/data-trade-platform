import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { createCorrectionRequest, listCorrectionRequestsForForm } from '@/lib/services/dataQualityService';

type Params = { params: Promise<{ formId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const requests = await listCorrectionRequestsForForm(formId);
  return NextResponse.json({ requests });
}

// 결측치·이상치 조회 화면에서 "수정 요청 보내기" — 발견-조치 사이클의 조치 쪽.
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = await request.json();
  try {
    const req = await createCorrectionRequest(
      {
        formId,
        campaignId: body.campaignId,
        submissionId: body.submissionId,
        fieldId: body.fieldId,
        issueType: body.issueType,
        reason: body.reason,
      },
      actor
    );
    return NextResponse.json({ request: req }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_RESPONDENT') {
      return NextResponse.json(
        { error: 'NO_RESPONDENT', message: '익명 응답이거나 응답자를 특정할 수 없어 수정 요청을 보낼 수 없습니다.' },
        { status: 400 }
      );
    }
    throw err;
  }
}
