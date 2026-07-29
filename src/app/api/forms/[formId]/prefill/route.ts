import { NextRequest, NextResponse } from 'next/server';
import { getActiveCampaign } from '@/lib/services/campaignService';
import { computePrefill } from '@/lib/services/prefillService';
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

  const campaign = identity.campaignId
    ? { id: identity.campaignId }
    : await getActiveCampaign(formId);
  if (!campaign) {
    return NextResponse.json({ values: {}, sourceCampaignName: null, schemaChanged: false });
  }

  const template = await getFormTemplate(formId);
  const result = await computePrefill(formId, identity.user.id, campaign.id, template?.fields ?? []);
  return NextResponse.json(result);
}
