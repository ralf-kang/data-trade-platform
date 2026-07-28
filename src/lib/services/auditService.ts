import { prisma } from '@/lib/db';

export interface LogAuditInput {
  userEmail: string;
  action: string;
  target: string;
  details: string;
  severity?: 'info' | 'warning' | 'critical';
  formId?: string;
}

/** 구조화된 감사 로그 기록 — Postgres audit_logs 테이블(정형 데이터). */
export async function logAudit(entry: LogAuditInput) {
  return prisma.auditLog.create({
    data: {
      userEmail: entry.userEmail,
      action: entry.action,
      target: entry.target,
      details: entry.details,
      severity: entry.severity ?? 'info',
      formId: entry.formId,
    },
  });
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { time: 'desc' },
    take: limit,
  });
}
