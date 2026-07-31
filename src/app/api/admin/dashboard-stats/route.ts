import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getDashboardStats } from '@/lib/services/dashboardStatsService';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  return NextResponse.json(await getDashboardStats(actor.id));
}
