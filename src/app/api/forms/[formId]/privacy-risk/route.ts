import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { getFormTemplate } from '@/lib/elasticsearch';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { diagnoseCombinationRisk } from '@/lib/services/maskingService';

type Params = { params: Promise<{ formId: string }> };

/**
 * 응답 축적 후 조합 위험 사후 진단 — 2단계 k-익명성 로직(countQuasiIdentifierCombinations)을
 * 그대로 재사용한다. 설계 시점 경고(privacyWarningAck)와 달리, 실제로 쌓인 응답에서
 * 정말로 유일한 조합이 몇 건이나 나왔는지 알려준다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 조회할 수 있습니다.' }, { status: 403 });
  }

  const template = await getFormTemplate(formId);
  if (!template) return NextResponse.json({ error: 'FORM_NOT_FOUND' }, { status: 404 });

  const campaignId = request.nextUrl.searchParams.get('campaignId') ?? undefined;
  const diagnosis = await diagnoseCombinationRisk(formId, campaignId, template.fields);
  return NextResponse.json({ diagnosis });
}
