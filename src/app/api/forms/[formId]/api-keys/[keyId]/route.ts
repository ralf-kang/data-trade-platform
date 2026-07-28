import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { revokeApiKey } from '@/lib/services/apiKeyService';

type Params = { params: Promise<{ formId: string; keyId: string }> };

// 키는 삭제하지 않고 폐기(revoke) 처리한다 — 언제 누가 발급/폐기했는지 이력이 남아야
// 사고 조사 시 추적할 수 있기 때문이다.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId, keyId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 API 키를 폐기할 수 있습니다.' },
      { status: 403 }
    );
  }

  const key = await revokeApiKey(keyId, actor);
  return NextResponse.json({ key });
}
