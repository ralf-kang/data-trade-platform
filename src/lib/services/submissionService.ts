import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  createSubmission as esCreateSubmission,
  getFormTemplate,
  getRecentSubmissions as esGetRecentSubmissions,
  listSubmissions as esListSubmissions,
  updateSubmission as esUpdateSubmission,
} from '@/lib/elasticsearch';
import { isFormActiveNow } from '@/lib/services/formService';
import { bufferAnonymousPart, splitSubmission } from '@/lib/services/anonymityService';
import type { RespondentIdentity } from '@/lib/respondent';
import { logAudit } from '@/lib/services/auditService';
import { notifyFormOwner } from '@/lib/services/notificationService';
import type { ActingUser } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/auth';
import type { FormField } from '@/components/builder/types';

export async function listFormSubmissions(
  formId: string,
  opts: { page?: number; pageSize?: number; search?: string } = {}
) {
  return esListSubmissions({ formId, ...opts });
}

/**
 * 요구사항: "관리자는 양식지를 통해 얻은 데이터에 대해서 비정상 입력 또는 정규식에
 * 벗어난 데이터, 또는 이상치 데이터를 제외하거나, 수정 할 수 있도록 권한을 가져야 하며,
 * 관리자는 관련 이상치 데이터에 대해서 보고/알림을 받을 수 있어야 함."
 *
 * 제출을 거부하지는 않는다(실사용자 입력을 그냥 버리면 안 되므로) — 대신 이상치를
 * 감지해 감사 로그와 소유자 알림으로 남기고, 관리자가 데이터 뷰어에서 직접 확인/수정할
 * 수 있게 한다.
 */
function detectAnomalies(fields: FormField[], data: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const field of fields) {
    const value = data[field.id];
    const isEmpty = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      issues.push(`필수 항목 미입력: ${field.label}`);
      continue;
    }
    if (isEmpty) continue;

    if (field.regexPattern && typeof value === 'string') {
      try {
        if (!new RegExp(field.regexPattern).test(value)) {
          issues.push(`정규식 형식 불일치: ${field.label} = "${value}"`);
        }
      } catch {
        // 저장된 정규식 패턴 자체가 잘못된 경우는 검증을 건너뛴다.
      }
    }
    if (field.type === 'number' && typeof value === 'string' && value !== '' && Number.isNaN(Number(value))) {
      issues.push(`숫자 형식 오류: ${field.label} = "${value}"`);
    }
  }
  return issues;
}

export async function submitFormResponse(
  formId: string,
  data: Record<string, unknown>,
  identity?: RespondentIdentity
) {
  const registry = await prisma.formRegistry.findUnique({ where: { id: formId } });
  if (!registry) throw new Error('FORM_NOT_FOUND');
  if (
    !isFormActiveNow({
      status: registry.status,
      startsAt: registry.startsAt?.toISOString() ?? null,
      expiresAt: registry.expiresAt?.toISOString() ?? null,
    })
  ) {
    throw new Error('FORM_NOT_ACTIVE');
  }

  const template = await getFormTemplate(formId);
  const fields = template?.fields ?? [];

  // 이상치 검증은 분할 "전" 전체 데이터로 수행한다 — 익명 문항도 형식 검증은 받아야 한다.
  // 단, 로그·알림에 남길 수 있는 것은 일반 문항의 이상치뿐이다(아래 참조).
  const anomalies = template ? detectAnomalies(fields, data) : [];

  // 문항 단위 익명성(2단계): anonymous 플래그 기준으로 두 조각으로 나눈다.
  // 분할은 반드시 서버에서 — 클라이언트가 두 요청으로 나누면 네트워크에서 상관관계가 샌다.
  const { identified, anonymous, hasAnonymousFields } = splitSubmission(fields, data);

  const submissionId = `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  // 식별 문서 — 익명 문항이 전부여도 참여 사실은 남긴다(응답률·보상의 근거).
  await esCreateSubmission({
    formId,
    submissionId,
    submittedAt,
    data: identified,
    respondentId: identity?.user?.id,
    identityLevel: identity?.level ?? 'ANONYMOUS',
  });

  // 익명 조각 — 즉시 색인하지 않고 버퍼로. k건이 모이면 셔플되어 적재된다.
  if (hasAnonymousFields) {
    await bufferAnonymousPart(formId, anonymous, registry.schemaVersion);
  }

  await prisma.formRegistry
    .update({ where: { id: formId }, data: { submissionCount: { increment: 1 } } })
    .catch(() => undefined);

  if (anomalies.length > 0) {
    // 익명 문항 이상치는 라벨·값·응답자를 로그에 남기면 익명성이 그대로 깨진다.
    // 일반 문항 이상치만 상세를 남기고, 익명 문항은 건수만 집계한다.
    const anonymousIds = new Set(fields.filter((f) => f.anonymous).map((f) => f.id));
    const anonymousLabels = new Set(
      fields.filter((f) => anonymousIds.has(f.id)).map((f) => f.label)
    );
    const identifiedAnomalies = anomalies.filter(
      (msg) => ![...anonymousLabels].some((label) => msg.includes(label))
    );
    const anonAnomalyCount = anomalies.length - identifiedAnomalies.length;

    const details = [
      ...identifiedAnomalies,
      ...(anonAnomalyCount > 0 ? [`익명 문항 ${anonAnomalyCount}건 형식 이상 (상세 비공개)`] : []),
    ].join('; ');

    await logAudit({
      userEmail: 'system(public-submit)',
      action: 'DATA_ANOMALY',
      target: `Form [${formId}] Data [${submissionId}]`,
      details,
      severity: 'warning',
      formId,
    });
    if (registry.ownerId) {
      await notifyFormOwner({
        userId: registry.ownerId,
        formId,
        type: 'ANOMALY',
        message: `[${template?.title ?? formId}] 제출 데이터(${submissionId})에서 이상치가 감지되었습니다: ${details}`,
        severity: 'warning',
      });
    }
  }

  return { submissionId, submittedAt, anomalies };
}

export async function editSubmission(
  formId: string,
  submissionId: string,
  data: Record<string, unknown>,
  actor: ActingUser
) {
  await esUpdateSubmission(formId, submissionId, data);
  await logAudit({
    userEmail: actor.email,
    action: 'DATA_UPDATE',
    target: `Form [${formId}] Data [${submissionId}]`,
    details: '수동 재가공 (관리자 수정)',
    severity: 'warning',
    formId,
  });
}

// 대량 추출(엑셀/CSV) 전용 — 클라이언트가 pageSize를 직접 크게 요청할 수 없도록
// 서버 내부에서만 페이지를 순회하고, 전체 상한(EXPORT_HARD_CAP)을 넘지 않게 한다.
// 모든 호출은 감사 로그(DATA_EXPORT)에 남아 데이터베이스제작자 권리 침해 발생 시
// 소명·추적 근거가 된다 (저작권법 제93조).
const EXPORT_PAGE_SIZE = 200;
const EXPORT_HARD_CAP = 5000;

export async function exportFormSubmissions(
  formId: string,
  actor: ActingUser,
  opts: { search?: string } = {}
) {
  const collected: Awaited<ReturnType<typeof esListSubmissions>>['items'] = [];
  let page = 1;
  let total = 0;
  while (collected.length < EXPORT_HARD_CAP) {
    const result = await esListSubmissions({
      formId,
      page,
      pageSize: EXPORT_PAGE_SIZE,
      search: opts.search,
    });
    total = result.total;
    collected.push(...result.items);
    if (result.items.length < EXPORT_PAGE_SIZE || collected.length >= total) break;
    page += 1;
  }
  const truncated = total > collected.length;

  await logAudit({
    userEmail: actor.email,
    action: 'DATA_EXPORT',
    target: `Form [${formId}]`,
    details: `제출 데이터 ${collected.length}건 CSV 추출${truncated ? ` (전체 ${total}건 중 상한으로 절단됨)` : ''}`,
    severity: truncated ? 'warning' : 'info',
    formId,
  });

  return { items: collected, total, truncated };
}

/**
 * 통합 조회(데이터 허브) 화면용 — 로그인한 관리자가 접근 권한을 가진(소유 또는 승인된
 * 공유) 양식지의 제출 데이터만 노출한다. 넉넉히 더 가져온 뒤(over-fetch) 필터링하므로
 * 정확한 limit을 보장하지는 않지만, 접근 불가 데이터가 새어나가지 않는 것이 우선이다.
 */
export async function recentSubmissionsAcrossForms(limit = 10, actor?: ActingUser) {
  const submissions = await esGetRecentSubmissions(limit * 5);
  const formIds = [...new Set(submissions.map((s) => s.formId))];
  const registries = await prisma.formRegistry.findMany({
    where: { id: { in: formIds } },
  });
  const idToRegistry = new Map(registries.map((r) => [r.id, r]));

  let accessibleFormIds: Set<string> | null = null;
  if (actor && !isPlatformAdmin(actor)) {
    // fromUser가 권한을 받는 쪽(요청자), toUser가 승인하는 소유자 — 공유받은 건 fromUserId로 찾는다.
    const approvedShares = await prisma.shareRequest.findMany({
      where: { fromUserId: actor.id, status: 'APPROVED', formId: { in: formIds } },
      select: { formId: true },
    });
    accessibleFormIds = new Set([
      ...registries.filter((r) => r.ownerId === actor.id).map((r) => r.id),
      ...approvedShares.map((s) => s.formId),
    ]);
  }

  return submissions
    .filter((s) => !accessibleFormIds || accessibleFormIds.has(s.formId))
    .slice(0, limit)
    .map((s) => ({
      ...s,
      formStatus: idToRegistry.get(s.formId)?.status ?? null,
    }));
}
