import { prisma } from '@/lib/db';
import { aggregateSubmissionStats, listFormTemplates } from '@/lib/elasticsearch';
import { shouldMaskForm } from './maskingService';

/**
 * 대시보드 지표 — **저장된 카운터가 아니라 실제 집계**를 쓴다.
 *
 * `FormRegistry.submissionCount`는 비정규화 카운터라 재시드·수동 삭제·색인 재구성으로
 * 실제 문서 수와 어긋난다(실제로 718 vs 825까지 벌어져 있었다). 대시보드는 "지금 몇
 * 건인가"를 답하는 화면이므로 어긋난 값을 보여주면 화면 전체의 신뢰가 무너진다.
 * ES 집계 한 번으로 전 폼 수치를 얻으므로 비용도 크지 않다.
 */

export interface DashboardStats {
  /** 폼 수 — 전체 / 내 소유 */
  formCount: number;
  myFormCount: number;
  /** 실제 제출 문서 수(집계 기준) */
  submissionTotal: number;
  /** 저장된 카운터 합계 — 실제와 다르면 화면에서 불일치를 알린다 */
  storedCounterTotal: number;
  /** 최근 N일 일자별 제출 수 */
  daily: Array<{ date: string; count: number }>;
  /** 제출이 많은 순 상위 폼 */
  topForms: Array<{ formId: string; title: string; count: number }>;
  /** 조치가 필요한 것들 */
  actionItems: {
    pendingShareRequests: number;
    pendingCorrections: number;
    pendingApprovals: number;
    pendingAuthorAuths: number;
  };
  /** 개인정보 관점 요약 */
  privacy: {
    maskedForms: number;
    totalForms: number;
    approvedHandlers: number;
    identifiedForms: number;
  };
  /** 분류 정리 상태 — 방금 도입한 분류 체계가 실제로 쓰이는지 */
  taxonomy: {
    categorized: number;
    uncategorized: number;
  };
}

export async function getDashboardStats(actorId: string | null, days = 14): Promise<DashboardStats> {
  const [
    registries,
    templates,
    esStats,
    pendingShareRequests,
    pendingCorrections,
    pendingApprovals,
    pendingAuthorAuths,
    approvedHandlers,
    categorizedRows,
  ] = await Promise.all([
    prisma.formRegistry.findMany({
      select: { id: true, ownerId: true, submissionCount: true, authorHadPrivacyAuth: true, maskingExemptedAt: true, identityMode: true },
    }),
    listFormTemplates(),
    aggregateSubmissionStats(days),
    prisma.shareRequest.count({ where: { status: 'PENDING' } }),
    prisma.submissionCorrectionRequest.count({ where: { status: 'PENDING' } }),
    prisma.formApprovalRequest.count({ where: { status: 'PENDING' } }),
    prisma.authorAuthorization.count({ where: { status: 'PENDING' } }),
    prisma.authorAuthorization.count({ where: { status: 'APPROVED' } }),
    prisma.formCategoryAssignment.findMany({ select: { formId: true }, distinct: ['formId'] }),
  ]);

  const titleById = new Map(templates.map((t) => [t.formId, t.title]));

  const topForms = Object.entries(esStats.byForm)
    .map(([formId, count]) => ({ formId, title: titleById.get(formId) ?? formId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const categorized = new Set(categorizedRows.map((r) => r.formId));

  return {
    formCount: registries.length,
    myFormCount: actorId ? registries.filter((r) => r.ownerId === actorId).length : 0,
    submissionTotal: esStats.total,
    storedCounterTotal: registries.reduce((s, r) => s + r.submissionCount, 0),
    daily: esStats.daily,
    topForms,
    actionItems: { pendingShareRequests, pendingCorrections, pendingApprovals, pendingAuthorAuths },
    privacy: {
      maskedForms: registries.filter((r) => shouldMaskForm(r)).length,
      totalForms: registries.length,
      approvedHandlers,
      identifiedForms: registries.filter((r) => r.identityMode !== 'ANONYMOUS').length,
    },
    taxonomy: {
      categorized: categorized.size,
      uncategorized: registries.filter((r) => !categorized.has(r.id)).length,
    },
  };
}
