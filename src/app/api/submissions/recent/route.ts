import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { recentSubmissionsAcrossForms } from '@/lib/services/submissionService';

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10') || 10;
  const submissions = await recentSubmissionsAcrossForms(limit);
  return NextResponse.json({ submissions });
}
