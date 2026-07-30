import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { listMyCorrectionRequests } from '@/lib/services/dataQualityService';

// 임직원 마이페이지 — 나에게 온 수정 요청 목록.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  const requests = await listMyCorrectionRequests(actor.id);
  return NextResponse.json({ requests });
}
