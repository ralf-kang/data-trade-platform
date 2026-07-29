import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { revokeToken } from '@/lib/respondent';
import { logAudit } from '@/lib/services/auditService';

type Params = { params: Promise<{ formId: string; tokenId: string }> };

// 링크는 삭제하지 않고 폐기(revoke)한다 — 언제 누가 발급/폐기했는지 이력이 남아야
// 사고 조사 시 추적할 수 있기 때문이다. 폐기 즉시 해당 쿠키 세션도 무효가 된다.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId, tokenId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 응답 링크를 폐기할 수 있습니다.' },
      { status: 403 }
    );
  }

  await revokeToken(tokenId);
  await logAudit({
    userEmail: actor.email,
    action: 'RESPONDENT_TOKEN_REVOKE',
    target: `Form [${formId}] Token [${tokenId}]`,
    details: '개인화 응답 링크 폐기',
    severity: 'warning',
    formId,
  });
  return NextResponse.json({ ok: true });
}
