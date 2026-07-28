import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { updateShareRequestStatus } from '@/lib/services/shareRequestService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  if (body.status !== 'APPROVED' && body.status !== 'REJECTED') {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  const updated = await updateShareRequestStatus(id, body.status, actor);
  return NextResponse.json({ request: updated });
}
