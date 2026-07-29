import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { createCampaign, getCampaignProgress, listCampaigns } from '@/lib/services/campaignService';

type Params = { params: Promise<{ formId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 회차를 관리할 수 있습니다.' }, { status: 403 });
  }

  const campaigns = await listCampaigns(formId);
  // 진행률(발송/열람/응답)은 응답률이 낮을 때 원인을 가리는 데 쓰인다.
  const withProgress = await Promise.all(
    campaigns.map(async (c) => ({ ...c, progress: await getCampaignProgress(c.id) }))
  );
  return NextResponse.json({ campaigns: withProgress });
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 회차를 만들 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json();
  if (!body?.name || !body?.startsAt) {
    return NextResponse.json({ error: 'name과 startsAt이 필요합니다.' }, { status: 400 });
  }

  const campaign = await createCampaign(
    formId,
    {
      name: body.name,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      anonymityThreshold: body.anonymityThreshold ?? null,
    },
    actor
  );
  return NextResponse.json({ campaign }, { status: 201 });
}
