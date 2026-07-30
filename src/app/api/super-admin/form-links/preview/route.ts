import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { previewFormLinkMatches } from '@/lib/services/formLinkService';

// 엣지/노드 호버 팝오버(§2-2 step 5) — 최근 레코드 5건 이하, 구조 확인용.
export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const result = await previewFormLinkMatches(
    { formId: body.leftFormId, fieldId: body.leftFieldId },
    { formId: body.rightFormId, fieldId: body.rightFieldId },
    body.normalization ?? {}
  );
  return NextResponse.json(result);
}
