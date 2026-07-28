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
