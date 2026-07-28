import { NextRequest, NextResponse } from 'next/server';
import { recentSubmissionsAcrossForms } from '@/lib/services/submissionService';

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '10') || 10;
  const submissions = await recentSubmissionsAcrossForms(limit);
  return NextResponse.json({ submissions });
}
