import { getFormTemplate, getSubmission, listSubmissions as esListSubmissions } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import type { ActingUser } from '@/lib/auth';
import { logAudit } from './auditService';
import type { CorrectionRequestIssueType } from '@/generated/prisma/client';

/**
 * 결측치·이상치 조회 (docs/데이터품질-검증구간-설계.md §5 순위 5 — "품질 대시보드 + 정정 요청").
 *
 * 익명 문항은 원천 제외한다 — 정정 요청은 반드시 응답자를 특정해야 하는데, 익명 문항은
 * 응답자와 분리 저장되어 애초에 "누구에게 요청할지" 알 수 없다.
 *
 * 자유서술형(text/textarea/regex-input)은 마스킹 계층의 보호 대상이므로 **이상치 판정에서
 * 제외**한다 — 값을 비교·노출하는 순간 마스킹을 우회하게 된다. 결측 여부(비어 있는가)는
 * 내용을 드러내지 않으므로 자유서술형에도 적용한다.
 */

const SCAN_PAGE_SIZE = 200;
const SCAN_HARD_CAP = 3000;
const MIN_SAMPLES_FOR_OUTLIER = 8; // 표본이 너무 적으면 사분위수 자체가 무의미하다
const SKIP_TYPES = new Set([
  'file', 'signature', 'image', 'image-gallery', 'video-link', 'table',
  'nested-report', 'report-link', 'comment-thread', 'slide-card', 'popup-toggle',
  'privacy-consent', 'api-select', 'csv-select',
]);
const NUMERIC_TYPES = new Set(['number']);

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export interface MissingFieldStat {
  fieldId: string;
  label: string;
  type: string;
  missingCount: number;
  totalCount: number;
  missingRate: number;
  sampleSubmissionIds: string[];
}

export interface OutlierEntry {
  submissionId: string;
  fieldId: string;
  label: string;
  value: number;
  reason: string;
}

export interface QualityReport {
  totalSubmissions: number;
  missing: MissingFieldStat[];
  outliers: OutlierEntry[];
}

async function scanSubmissions(formId: string) {
  const collected: Array<{ submissionId: string; campaignId?: string; data: Record<string, unknown> }> = [];
  let page = 1;
  let total = 0;
  while (collected.length < SCAN_HARD_CAP) {
    const result = await esListSubmissions({ formId, page, pageSize: SCAN_PAGE_SIZE });
    total = result.total;
    collected.push(...result.items.map((it) => ({ submissionId: it.submissionId, campaignId: it.campaignId, data: it.data })));
    if (result.items.length < SCAN_PAGE_SIZE || collected.length >= total) break;
    page += 1;
  }
  return { items: collected, total };
}

export async function analyzeFormQuality(formId: string): Promise<QualityReport> {
  const template = await getFormTemplate(formId);
  if (!template) return { totalSubmissions: 0, missing: [], outliers: [] };

  const fields = template.fields.filter((f) => !f.anonymous && !SKIP_TYPES.has(f.type));
  const { items, total } = await scanSubmissions(formId);

  const missing: MissingFieldStat[] = [];
  const outliers: OutlierEntry[] = [];

  for (const field of fields) {
    const missingIds: string[] = [];
    const numericSamples: Array<{ submissionId: string; value: number }> = [];

    for (const item of items) {
      const value = item.data[field.id];
      if (isBlank(value)) {
        missingIds.push(item.submissionId);
        continue;
      }
      if (NUMERIC_TYPES.has(field.type) && typeof value === 'number') {
        numericSamples.push({ submissionId: item.submissionId, value });
      }
    }

    if (missingIds.length > 0) {
      missing.push({
        fieldId: field.id,
        label: field.label,
        type: field.type,
        missingCount: missingIds.length,
        totalCount: items.length,
        missingRate: items.length === 0 ? 0 : missingIds.length / items.length,
        sampleSubmissionIds: missingIds.slice(0, 10),
      });
    }

    // 이상치 — 사분위수 기반(IQR). 표본이 너무 적으면 판정을 건너뛴다.
    if (numericSamples.length >= MIN_SAMPLES_FOR_OUTLIER) {
      const sorted = [...numericSamples].sort((a, b) => a.value - b.value);
      const q1 = sorted[Math.floor(sorted.length * 0.25)].value;
      const q3 = sorted[Math.floor(sorted.length * 0.75)].value;
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      for (const s of numericSamples) {
        if (s.value < lower || s.value > upper) {
          outliers.push({
            submissionId: s.submissionId,
            fieldId: field.id,
            label: field.label,
            value: s.value,
            reason: s.value < lower ? `하위 이상치 (정상 범위 ${lower.toFixed(1)} 이상)` : `상위 이상치 (정상 범위 ${upper.toFixed(1)} 이하)`,
          });
        }
      }
    }
  }

  return { totalSubmissions: total, missing, outliers };
}

// ---------------------------------------------------------------------------
// 수정 요청 — 발견(위)-조치(정정 요청) 사이클의 조치 쪽.
// ---------------------------------------------------------------------------

export interface CreateCorrectionRequestInput {
  formId: string;
  campaignId?: string;
  submissionId: string;
  fieldId?: string;
  issueType: CorrectionRequestIssueType;
  reason: string;
}

/**
 * 익명 응답은 요청 대상이 될 수 없다 — respondentId를 ES 문서에서 가져오되, 없으면(익명)
 * 명시적으로 거부한다. 마스킹 여부와 무관하게 respondentId 자체는 식별 응답의 메타데이터로
 * 이미 저장되어 있다(마스킹은 응답 "내용"만 가린다).
 */
export async function createCorrectionRequest(input: CreateCorrectionRequestInput, actor: ActingUser) {
  const submission = await getSubmission(input.formId, input.submissionId);
  if (!submission?.respondentId) {
    throw new Error('NO_RESPONDENT');
  }

  const request = await prisma.submissionCorrectionRequest.create({
    data: {
      formId: input.formId,
      campaignId: input.campaignId,
      submissionId: input.submissionId,
      fieldId: input.fieldId,
      respondentId: submission.respondentId,
      issueType: input.issueType,
      reason: input.reason,
      requestedBy: actor.email,
    },
  });

  await prisma.adminNotification.create({
    data: {
      userId: submission.respondentId,
      formId: input.formId,
      type: 'CORRECTION_REQUEST',
      message: `제출하신 응답 중 확인이 필요한 항목이 있습니다: ${input.reason}`,
      severity: 'warning',
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'CORRECTION_REQUEST_CREATE',
    target: `Submission [${input.formId}/${input.submissionId}]`,
    details: `수정 요청: ${input.issueType} — ${input.reason}`,
    severity: 'info',
    formId: input.formId,
  });

  return request;
}

export async function listCorrectionRequestsForForm(formId: string) {
  return prisma.submissionCorrectionRequest.findMany({
    where: { formId },
    orderBy: { requestedAt: 'desc' },
  });
}

/** 임직원 마이페이지 — 나에게 온 수정 요청. */
export async function listMyCorrectionRequests(userId: string) {
  return prisma.submissionCorrectionRequest.findMany({
    where: { respondentId: userId, status: 'PENDING' },
    orderBy: { requestedAt: 'desc' },
  });
}

export async function dismissCorrectionRequest(id: string, actor: ActingUser) {
  const req = await prisma.submissionCorrectionRequest.update({
    where: { id },
    data: { status: 'DISMISSED', resolvedAt: new Date() },
  });
  await logAudit({
    userEmail: actor.email,
    action: 'CORRECTION_REQUEST_DISMISS',
    target: `SubmissionCorrectionRequest [${id}]`,
    details: '수정 요청 취소',
    severity: 'info',
  });
  return req;
}

/** 응답자가 재제출(수정)하면 관련 PENDING 요청을 자동으로 RESOLVED 처리한다. */
export async function resolveCorrectionRequestsForSubmission(formId: string, submissionId: string): Promise<void> {
  await prisma.submissionCorrectionRequest.updateMany({
    where: { formId, submissionId, status: 'PENDING' },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}

