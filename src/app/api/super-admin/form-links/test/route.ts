import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { testConnection } from '@/lib/services/formLinkService';

// 연결 테스트(§2-2 step 3) — 엣지 생성 즉시 호출된다. 슈퍼관리자 전용(§5-2).
export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const actor = await getCurrentUser();
  const result = await testConnection(
    { formId: body.leftFormId, fieldId: body.leftFieldId },
    { formId: body.rightFormId, fieldId: body.rightFieldId },
    body.normalization ?? {},
    actor
  );
  return NextResponse.json(result);
}
