import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getMyResponses } from '@/lib/services/memberService';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  return NextResponse.json({ responses: await getMyResponses(user.id) });
}
