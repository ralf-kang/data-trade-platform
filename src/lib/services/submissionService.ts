import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  createSubmission as esCreateSubmission,
  getRecentSubmissions as esGetRecentSubmissions,
  listSubmissions as esListSubmissions,
  updateSubmission as esUpdateSubmission,
} from '@/lib/elasticsearch';
import { logAudit } from '@/lib/services/auditService';
import type { AdminUser } from '@/generated/prisma/client';

export async function listFormSubmissions(
  formId: string,
  opts: { page?: number; pageSize?: number; search?: string } = {}
) {
  return esListSubmissions({ formId, ...opts });
}

export async function submitFormResponse(formId: string, data: Record<string, unknown>) {
  const submissionId = `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  await esCreateSubmission({ formId, submissionId, submittedAt, data });
  await prisma.formRegistry
    .update({ where: { id: formId }, data: { submissionCount: { increment: 1 } } })
    .catch(() => undefined);

  return { submissionId, submittedAt };
}

export async function editSubmission(
  formId: string,
  submissionId: string,
  data: Record<string, unknown>,
  actor: AdminUser
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
  actor: AdminUser,
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

export async function recentSubmissionsAcrossForms(limit = 10) {
  const submissions = await esGetRecentSubmissions(limit);
  const formIds = [...new Set(submissions.map((s) => s.formId))];
  const registries = await prisma.formRegistry.findMany({
    where: { id: { in: formIds } },
  });
  const idToStatus = new Map(registries.map((r) => [r.id, r.status]));
  return submissions.map((s) => ({
    ...s,
    formStatus: idToStatus.get(s.formId) ?? null,
  }));
}
