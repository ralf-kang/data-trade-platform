import { prisma } from '@/lib/db';
import { getFormTemplate, getSubmission } from '@/lib/elasticsearch';
import type { FormField } from '@/components/builder/types';
import type { ActingUser } from '@/lib/auth';
import { canSeeRewards, getSystemConfig } from '@/lib/services/systemConfigService';

/**
 * 임직원(Member) 마이페이지 데이터.
 *
 * 이 영역이 필요한 이유는 조회 편의만이 아니다:
 *   1. "조치 필요"를 한곳에 모으면 여러 부서의 요청이 흩어지지 않아 응답률이 올라간다.
 *   2. 정정 기능은 데이터 주인이 직접 고치는 것이므로 가장 값싼 품질 개선 수단이다.
 *   3. 자기 데이터를 볼 수 있어야 정보주체 권리(열람·정정) 대응의 창구가 된다.
 *
 * 익명 문항은 이 계층 어디에서도 값을 돌려주지 않는다 — 본인에게 보여주는 것조차
 * "당신과 연결되어 저장돼 있다"는 뜻이 되어 익명성 주장이 무너진다.
 */

export interface PendingAction {
  campaignId: string;
  campaignName: string;
  formId: string;
  formTitle: string;
  endsAt: string | null;
  /** 마감까지 남은 일수. null이면 기한 없음. */
  daysLeft: number | null;
}

/** 응답이 필요한데 아직 안 낸 회차 — 대시보드 최상단에 온다. */
export async function getPendingActions(userId: string): Promise<PendingAction[]> {
  const targets = await prisma.campaignTarget.findMany({
    where: {
      userId,
      respondedAt: null,
      campaign: { status: 'OPEN' },
    },
    include: { campaign: true },
    orderBy: { invitedAt: 'desc' },
  });

  const result: PendingAction[] = [];
  for (const t of targets) {
    const template = await getFormTemplate(t.campaign.formId);
    const endsAt = t.campaign.endsAt;
    result.push({
      campaignId: t.campaignId,
      campaignName: t.campaign.name,
      formId: t.campaign.formId,
      formTitle: template?.title ?? t.campaign.formId,
      endsAt: endsAt?.toISOString() ?? null,
      daysLeft: endsAt
        ? Math.ceil((endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null,
    });
  }
  return result;
}

export interface MyResponseItem {
  campaignId: string;
  campaignName: string;
  sequence: number;
  formId: string;
  formTitle: string;
  submittedAt: string;
  revision: number;
  hasAnonymousFields: boolean;
}

/** 내가 응답한 이력 (최신순). */
export async function getMyResponses(userId: string, limit?: number): Promise<MyResponseItem[]> {
  const parts = await prisma.campaignParticipation.findMany({
    where: { userId },
    include: { campaign: true },
    orderBy: { submittedAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  });

  const templateCache = new Map<string, { title: string; fields: FormField[] } | null>();
  const result: MyResponseItem[] = [];

  for (const p of parts) {
    const formId = p.campaign.formId;
    if (!templateCache.has(formId)) {
      const t = await getFormTemplate(formId);
      templateCache.set(formId, t ? { title: t.title, fields: t.fields } : null);
    }
    const template = templateCache.get(formId);
    result.push({
      campaignId: p.campaignId,
      campaignName: p.campaign.name,
      sequence: p.campaign.sequence,
      formId,
      formTitle: template?.title ?? formId,
      submittedAt: p.submittedAt.toISOString(),
      revision: p.revision,
      hasAnonymousFields: !!template?.fields.some((f) => f.anonymous),
    });
  }
  return result;
}

export interface MyResponseDetail {
  formTitle: string;
  campaignName: string;
  submittedAt: string;
  revision: number;
  fields: Array<{
    id: string;
    label: string;
    /** 익명 문항이면 값을 담지 않는다. */
    value: unknown | null;
    anonymous: boolean;
  }>;
}

/** 특정 회차의 내 응답 상세. 익명 문항은 값 대신 표시만 남긴다. */
export async function getMyResponseDetail(
  userId: string,
  campaignId: string
): Promise<MyResponseDetail | null> {
  const part = await prisma.campaignParticipation.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
    include: { campaign: true },
  });
  if (!part) return null;

  const template = await getFormTemplate(part.campaign.formId);
  if (!template) return null;

  const doc = await getSubmission(part.campaign.formId, part.submissionId);
  const data = doc?.data ?? {};

  return {
    formTitle: template.title,
    campaignName: part.campaign.name,
    submittedAt: part.submittedAt.toISOString(),
    revision: part.revision,
    fields: template.fields.map((f) => ({
      id: f.id,
      label: f.label,
      // 익명 문항은 애초에 식별 문서에 없지만, 명시적으로 null을 넣어
      // "조회할 수 없음"을 화면이 확실히 표현하게 한다.
      value: f.anonymous ? null : (data[f.id] ?? null),
      anonymous: !!f.anonymous,
    })),
  };
}

export interface MyTrend {
  formId: string;
  formTitle: string;
  /** 회차는 오래된 순 — 왼쪽에서 오른쪽으로 시간이 흐르게 표시한다. */
  campaigns: Array<{ id: string; name: string; sequence: number; schemaVersion: number }>;
  rows: Array<{
    fieldId: string;
    label: string;
    anonymous: boolean;
    /** 회차 순서와 같은 길이. 미응답 회차는 null. */
    values: Array<unknown | null>;
    changed: boolean;
  }>;
  /** 회차 간 스키마 버전이 달라 값을 곧이곧대로 비교하면 안 되는 경우 */
  schemaChanged: boolean;
}

/**
 * 반복 수집 양식에서 내 값이 회차마다 어떻게 바뀌었는지.
 *
 * 익명 문항은 회차 간 연결 자체가 재식별 경로이므로 값 없이 표시만 한다.
 * 회차가 2개 미만이면 추세가 성립하지 않아 null을 돌려준다.
 */
export async function getMyTrend(userId: string, formId: string): Promise<MyTrend | null> {
  const parts = await prisma.campaignParticipation.findMany({
    where: { userId, campaign: { formId } },
    include: { campaign: true },
    orderBy: { campaign: { sequence: 'asc' } },
  });
  if (parts.length < 2) return null;

  const template = await getFormTemplate(formId);
  if (!template) return null;

  const campaigns = parts.map((p) => ({
    id: p.campaignId,
    name: p.campaign.name,
    sequence: p.campaign.sequence,
    schemaVersion: p.campaign.schemaVersion,
  }));
  const schemaChanged = new Set(campaigns.map((c) => c.schemaVersion)).size > 1;

  // 회차별 응답 본문을 모은다.
  const dataByCampaign = new Map<string, Record<string, unknown>>();
  for (const p of parts) {
    const doc = await getSubmission(formId, p.submissionId);
    dataByCampaign.set(p.campaignId, doc?.data ?? {});
  }

  const rows = template.fields.map((f) => {
    const values = campaigns.map((c) =>
      f.anonymous ? null : (dataByCampaign.get(c.id)?.[f.id] ?? null)
    );
    const present = values.filter((v) => v !== null && v !== undefined);
    const changed =
      !f.anonymous && present.length > 1 && new Set(present.map((v) => JSON.stringify(v))).size > 1;
    return { fieldId: f.id, label: f.label, anonymous: !!f.anonymous, values, changed };
  });

  return { formId, formTitle: template.title, campaigns, rows, schemaChanged };
}

export interface PointSummary {
  /** 잔액 — 지급 완료(PAID)된 것만 집계한다. */
  balance: number;
  pending: number;
  rejected: number;
  entries: Array<{
    id: string;
    delta: number;
    reason: string;
    status: string;
    statusReason: string | null;
    createdAt: string;
  }>;
  /** 원장이 비어 있으면 보상 제도가 아직 운영 전이라는 뜻 */
  programStarted: boolean;
}

/**
 * 포인트 현황. 잔액은 컬럼이 아니라 원장 합계로 계산한다 —
 * 잔액 컬럼을 두고 UPDATE 하면 동시성 사고가 나고 분쟁 시 증명이 불가능하다.
 */
export async function getPointSummary(userId: string): Promise<PointSummary> {
  const entries = await prisma.pointLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const sum = (status: string) =>
    entries.filter((e) => e.status === status).reduce((acc, e) => acc + e.delta, 0);

  return {
    balance: sum('PAID'),
    pending: sum('PENDING') + sum('APPROVED'),
    rejected: sum('REJECTED'),
    entries: entries.map((e) => ({
      id: e.id,
      delta: e.delta,
      reason: e.reason,
      status: e.status,
      statusReason: e.statusReason,
      createdAt: e.createdAt.toISOString(),
    })),
    programStarted: entries.length > 0,
  };
}

export interface GatedPointSummary {
  /** 보상 화면을 이 사용자에게 노출할지 — SystemConfig.rewardVisibility 단일 판정 결과. */
  visible: boolean;
  /** visible=true이면서 아직 ADMIN_ONLY(정식 운영 전) 단계일 때 — "🚧 개발 중" 배지용. */
  developmentPreview: boolean;
  summary: PointSummary | null;
}

/**
 * 화면·API 어느 쪽에서 호출하든 canSeeRewards() 하나로만 판정한다 — 화면만 가리면
 * API(/api/me/points, /api/me/summary)로 그대로 우회되기 때문이다.
 */
export async function getGatedPointSummary(actor: ActingUser): Promise<GatedPointSummary> {
  const [visible, { rewardVisibility }] = await Promise.all([canSeeRewards(actor), getSystemConfig()]);
  if (!visible) return { visible: false, developmentPreview: false, summary: null };
  return {
    visible: true,
    developmentPreview: rewardVisibility === 'ADMIN_ONLY',
    summary: await getPointSummary(actor.id),
  };
}

/** 대시보드 요약 — 위젯에 쓰이는 숫자들. */
export async function getMemberSummary(actor: ActingUser) {
  const userId = actor.id;
  const [pending, participations, forms, points] = await Promise.all([
    getPendingActions(userId),
    prisma.campaignParticipation.count({ where: { userId } }),
    prisma.campaignParticipation.findMany({
      where: { userId },
      select: { campaign: { select: { formId: true } } },
      distinct: ['campaignId'],
    }),
    getGatedPointSummary(actor),
  ]);

  const distinctForms = new Set(forms.map((f) => f.campaign.formId)).size;
  const targeted = await prisma.campaignTarget.count({ where: { userId } });

  return {
    pendingCount: pending.length,
    responseCount: participations,
    formCount: distinctForms,
    targetedCount: targeted,
    points,
  };
}
