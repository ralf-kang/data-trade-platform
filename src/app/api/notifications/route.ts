import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { listNotifications } from '@/lib/services/notificationService';

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === '1';
  const notifications = await listNotifications(actor.id, unreadOnly);
  return NextResponse.json({ notifications });
}
