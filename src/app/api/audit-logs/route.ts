import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listAuditLogs } from '@/lib/services/auditService';

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100') || 100;
  const logs = await listAuditLogs(limit);
  return NextResponse.json({ logs });
}
