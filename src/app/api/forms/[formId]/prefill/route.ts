import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaign } from '@/lib/services/campaignService';
import { computePrefill, computeLdapAutoFill } from '@/lib/services/prefillService';
import { getFormTemplate } from '@/lib/elasticsearch';
import { resolveRespondent } from '@/lib/respondent';

type Params = { params: Promise<{ formId: string }> };

/**
 * 응답 화면용 사전 채움 값.
 *
 * 응답자 본인의 직전 회차 값만 돌려주므로 별도 권한 검사 대신 응답 세션(쿠키)으로
 * 신원을 확인한다. 신원이 없으면(익명 접근) 채울 근거가 없으므로 빈 결과다.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const identity = await resolveRespondent(formId);
  if (!identity.user) {
    return NextResponse.json({ values: {}, sourceCampaignName: null, schemaChanged: false });
  }

  const template = await getFormTemplate(formId);
  const fields = template?.fields ?? [];

  // LDAP 자동 채움은 회차(campaign) 이력과 무관하게 항상 계산할 수 있다 — 먼저 구하고,
  // 이력 기반 사전 채움과 병합할 때 같은 필드는 LDAP 값이 우선한다(신뢰도가 더 높다).
  const ldapValues = computeLdapAutoFill(identity.user, fields);

  const campaign = identity.campaignId
    ? { id: identity.campaignId }
    : await getActiveCampaign(formId);
  if (!campaign) {
    return NextResponse.json({ values: ldapValues, sourceCampaignName: null, schemaChanged: false });
  }

  const historyResult = await computePrefill(formId, identity.user.id, campaign.id, fields);
  return NextResponse.json({ ...historyResult, values: { ...historyResult.values, ...ldapValues } });
}
