import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { listOntologyConsents } from '@/lib/services/formLinkService';

// "옵션 상세화면"(§2-5) — 관리자 계정별 동의 시각·상태 조회.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const consents = await listOntologyConsents();
  return NextResponse.json({ consents });
}
