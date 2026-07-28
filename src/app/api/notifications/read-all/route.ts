import { NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { markAllNotificationsRead } from '@/lib/services/notificationService';

export async function POST() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  await markAllNotificationsRead(actor.id);
  return NextResponse.json({ ok: true });
}
