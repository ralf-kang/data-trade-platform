import { NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { markNotificationRead } from '@/lib/services/notificationService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const actor = await getCurrentAdmin();
  await markNotificationRead(id, actor.id);
  return NextResponse.json({ ok: true });
}
