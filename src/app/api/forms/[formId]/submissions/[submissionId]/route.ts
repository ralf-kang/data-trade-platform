import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { editSubmission } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string; submissionId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { formId, submissionId } = await params;
  const body = await request.json();
  if (!body?.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data object is required' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  await editSubmission(formId, submissionId, body.data, actor);
  return NextResponse.json({ ok: true });
}
