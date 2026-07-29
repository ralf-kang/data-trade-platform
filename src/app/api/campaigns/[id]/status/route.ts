import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { setCampaignStatus } from '@/lib/services/campaignService';

type Params = { params: Promise<{ id: string }> };

/**
 * 회차 상태 전환. CLOSED로 바꾸면 익명 버퍼의 잔여분이 함께 정리된다 —
 * 임계값에 못 미쳐 버퍼에 남아 있던 응답이 영영 색인되지 않으면 데이터가 조용히 사라진다.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });

  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(campaign.formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 회차 상태를 바꿀 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json();
  if (!['SCHEDULED', 'OPEN', 'CLOSED'].includes(body?.status)) {
    return NextResponse.json({ error: 'status must be SCHEDULED | OPEN | CLOSED' }, { status: 400 });
  }

  const updated = await setCampaignStatus(id, body.status, actor);
  return NextResponse.json({ campaign: updated });
}
