import { NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { ackOntologyConsent, getOntologyConsentStatus } from '@/lib/services/formLinkService';

// 관계 캔버스 최초 진입 시 안내 모달(§2-5) — 본인의 동의 상태 조회/기록.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const actor = await getCurrentUser();
  const status = await getOntologyConsentStatus(actor);
  return NextResponse.json(status);
}

export async function POST() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const actor = await getCurrentUser();
  await ackOntologyConsent(actor);
  return NextResponse.json({ ok: true });
}
