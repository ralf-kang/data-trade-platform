import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { listOwnedTextForms } from '@/lib/services/wordCloudService';

// 워드클라우드 범위 설정 툴바(§4-2)가 쓰는 목록 — 본인이 제작한 양식지 중 자유서술형
// 문항이 있는 것만 내려준다. 남의 양식지는 여기 아예 나타나지 않는다.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  const forms = await listOwnedTextForms(actor);
  return NextResponse.json({ forms });
}
