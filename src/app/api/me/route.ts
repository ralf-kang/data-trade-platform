import { NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';

// 클라이언트 컴포넌트가 "현재 로그인한 관리자가 누구인지(소유자 여부 비교 등)"를
// 알아야 할 때 사용하는 경량 엔드포인트.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  return NextResponse.json({
    id: actor.id,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    canBulkExport: actor.canBulkExport,
  });
}
