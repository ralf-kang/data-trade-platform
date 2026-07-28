import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { createShareRequest, listShareRequests } from '@/lib/services/shareRequestService';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  const { received, sent } = await listShareRequests(actor.id);
  return NextResponse.json({ received, sent });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  if (!body?.formId) {
    return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  try {
    const request_ = await createShareRequest(body.formId, actor);
    return NextResponse.json({ request: request_ }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to create share request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
