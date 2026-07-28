import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { editSubmission } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string; submissionId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId, submissionId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 제출 데이터를 수정할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (!body?.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data object is required' }, { status: 400 });
  }
  await editSubmission(formId, submissionId, body.data, actor);
  return NextResponse.json({ ok: true });
}
