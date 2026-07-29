import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { resolveTargetUsers, upsertTargets } from '@/lib/services/campaignService';
import { issueTokens } from '@/lib/respondent';
import { logAudit } from '@/lib/services/auditService';

type Params = { params: Promise<{ id: string }> };

/**
 * 회차 대상자 지정 + 개인화 링크 일괄 발급.
 * 원문 링크는 이 응답에만 존재한다 — DB에는 해시만 남아 재조회할 수 없다.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });

  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(campaign.formId, actor))) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '이 양식지의 소유자만 대상자를 지정할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json();
  const mode = body?.mode ?? 'EXPLICIT';
  const userIds = await resolveTargetUsers(campaign.formId, mode, {
    departments: body?.departments,
    userIds: body?.userIds,
  });
  if (userIds.length === 0) {
    return NextResponse.json({ error: 'NO_TARGETS', message: '대상자가 없습니다.' }, { status: 400 });
  }

  const added = await upsertTargets(id, userIds);

  const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  const baseUrl = config?.publicBaseUrl || request.nextUrl.origin;
  // 링크 만료는 회차 마감에 맞춘다 — 회차가 끝난 뒤에도 살아있는 링크는 위험만 남긴다.
  const expiresAt = campaign.endsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const tokens = await issueTokens(campaign.formId, userIds, {
    expiresAt,
    issuedBy: actor.email,
    baseUrl,
    campaignId: id,
  });

  // 발급된 토큰을 대상자 레코드에 연결해 열람/응답 추적이 가능하게 한다.
  for (const issued of tokens.issued) {
    await prisma.campaignTarget
      .updateMany({
        where: { campaignId: id, userId: issued.userId },
        data: { tokenId: issued.tokenId, invitedAt: new Date() },
      })
      .catch(() => undefined);
  }

  await logAudit({
    userEmail: actor.email,
    action: 'CAMPAIGN_TARGETS_SET',
    target: `Campaign [${campaign.name}]`,
    details: `대상자 ${userIds.length}명 (신규 ${added}), 링크 ${tokens.issued.length}건 발급`,
    severity: 'info',
    formId: campaign.formId,
  });

  return NextResponse.json({ targets: userIds.length, added, ...tokens }, { status: 201 });
}
