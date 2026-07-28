import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { createDirectShare } from '@/lib/services/shareRequestService';

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  if (!body?.formId || !body?.granteeUserId) {
    return NextResponse.json({ error: 'formId and granteeUserId are required' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  try {
    const share = await createDirectShare(body.formId, body.granteeUserId, actor);
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to share';
    const status = message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
