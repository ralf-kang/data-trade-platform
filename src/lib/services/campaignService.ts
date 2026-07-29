import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import { flushBuffer } from '@/lib/services/anonymityService';
import type { ActingUser } from '@/lib/auth';
import type { Campaign, CampaignStatus, TargetingMode } from '@/generated/prisma/client';

/**
 * 수집 회차(3단계).
 *
 * 이 계층이 푸는 문제: 지금까지는 "양식 = 한 번의 수집"이라 분기마다 걷으려면 양식을
 * 새로 만들어야 했고, 그 순간 과거 회차와의 연결이 끊겨 추세도 최신화도 불가능했다.
 * 회차를 분리하면 양식은 한 번만 만들고 회차만 늘리면 된다.
 */

/** 지금 응답을 받고 있는 회차. 여러 개면 가장 최근에 시작한 것. */
export async function getActiveCampaign(formId: string): Promise<Campaign | null> {
  const now = new Date();
  return prisma.campaign.findFirst({
    where: {
      formId,
      status: 'OPEN',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: 'desc' },
  });
}

export async function listCampaigns(formId: string) {
  return prisma.campaign.findMany({
    where: { formId },
    orderBy: { sequence: 'desc' },
    include: {
      _count: { select: { targets: true, participations: true } },
    },
  });
}

export interface CreateCampaignInput {
  name: string;
  startsAt: Date;
  endsAt?: Date | null;
  anonymityThreshold?: number | null;
  autoCreated?: boolean;
}

export async function createCampaign(
  formId: string,
  input: CreateCampaignInput,
  actor: ActingUser
): Promise<Campaign> {
  const form = await prisma.formRegistry.findUniqueOrThrow({ where: { id: formId } });
  const last = await prisma.campaign.findFirst({
    where: { formId },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });

  const campaign = await prisma.campaign.create({
    data: {
      formId,
      name: input.name,
      sequence: (last?.sequence ?? 0) + 1,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      // 회차 시작 시점의 스키마 버전을 박아둔다 — 이후 양식이 바뀌어도 이 회차
      // 데이터의 해석 기준은 고정되어야 한다.
      schemaVersion: form.schemaVersion,
      anonymityThreshold: input.anonymityThreshold ?? null,
      autoCreated: input.autoCreated ?? false,
      status: input.startsAt <= new Date() ? 'OPEN' : 'SCHEDULED',
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'CAMPAIGN_CREATE',
    target: `Form [${formId}] Campaign [${campaign.name}]`,
    details: `${campaign.sequence}회차 생성 (스키마 v${campaign.schemaVersion})`,
    severity: 'info',
    formId,
  });
  return campaign;
}

/**
 * 회차 상태 전환.
 *
 * CLOSED로 바꿀 때는 익명 버퍼의 잔여분을 반드시 정리한다 — 임계값에 못 미쳐
 * 버퍼에 남아 있던 응답이 영영 색인되지 않으면 데이터가 조용히 사라진다.
 * 대신 belowThreshold로 표시되어 조회에서는 계속 제외된다.
 */
export async function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  actor: ActingUser
): Promise<Campaign> {
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
  });

  if (status === 'CLOSED') {
    const flushed = await flushBuffer(campaign.formId, true, campaignId).catch(() => 0);
    if (flushed > 0) {
      await logAudit({
        userEmail: 'system(anonymity)',
        action: 'ANON_BUFFER_FLUSH',
        target: `Form [${campaign.formId}] Campaign [${campaign.name}]`,
        details: `회차 마감으로 익명 응답 ${flushed}건 정리 (임계값 미달 시 조회 제외)`,
        severity: 'info',
        formId: campaign.formId,
      });
    }
  }

  await logAudit({
    userEmail: actor.email,
    action: status === 'OPEN' ? 'CAMPAIGN_OPEN' : status === 'CLOSED' ? 'CAMPAIGN_CLOSE' : 'CAMPAIGN_UPDATE',
    target: `Form [${campaign.formId}] Campaign [${campaign.name}]`,
    details: `회차 상태 → ${status}`,
    severity: status === 'CLOSED' ? 'warning' : 'info',
    formId: campaign.formId,
  });
  return campaign;
}

// ---------------------------------------------------------------------------
// 대상자
// ---------------------------------------------------------------------------

/** 대상자 산정 — 실제 링크 발급은 호출부(API)에서 respondent.issueTokens로 수행한다. */
export async function resolveTargetUsers(
  formId: string,
  mode: TargetingMode,
  opts: { departments?: string[]; userIds?: string[]; previousCampaignId?: string }
): Promise<string[]> {
  switch (mode) {
    case 'ALL_MEMBERS': {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE', roles: { some: { role: 'MEMBER' } } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'DEPARTMENTS': {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE', department: { in: opts.departments ?? [] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'PREVIOUS_RESPONDENTS': {
      // 직전 회차에 실제로 응답한 사람만 — 최신화 요청에 적합하다.
      const prev =
        opts.previousCampaignId ??
        (
          await prisma.campaign.findFirst({
            where: { formId, status: 'CLOSED' },
            orderBy: { sequence: 'desc' },
            select: { id: true },
          })
        )?.id;
      if (!prev) return [];
      const parts = await prisma.campaignParticipation.findMany({
        where: { campaignId: prev },
        select: { userId: true },
      });
      return parts.map((p) => p.userId);
    }
    case 'EXPLICIT':
    default:
      return opts.userIds ?? [];
  }
}

export async function upsertTargets(campaignId: string, userIds: string[]): Promise<number> {
  let created = 0;
  for (const userId of userIds) {
    const existing = await prisma.campaignTarget.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    });
    if (existing) continue;
    await prisma.campaignTarget.create({ data: { campaignId, userId, invitedAt: new Date() } });
    created++;
  }
  return created;
}

/**
 * 진행률 — 발송/열람/응답을 나눠서 본다.
 * 합쳐서 "응답률 34%"만 보면 무엇을 고쳐야 하는지 알 수 없다:
 * 발송 대비 열람이 낮으면 제목·채널 문제이고, 열람 대비 응답이 낮으면 양식 자체가 문제다.
 */
export async function getCampaignProgress(campaignId: string) {
  const [targets, invited, opened, responded] = await Promise.all([
    prisma.campaignTarget.count({ where: { campaignId } }),
    prisma.campaignTarget.count({ where: { campaignId, invitedAt: { not: null } } }),
    prisma.campaignTarget.count({ where: { campaignId, openedAt: { not: null } } }),
    prisma.campaignParticipation.count({ where: { campaignId } }),
  ]);
  return { targets, invited, opened, responded };
}
