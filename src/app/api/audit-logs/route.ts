import { NextRequest, NextResponse } from 'next/server';
import { listAuditLogs } from '@/lib/services/auditService';

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100') || 100;
  const logs = await listAuditLogs(limit);
  return NextResponse.json({ logs });
}
