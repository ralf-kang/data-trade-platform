import type { FormField } from '@/components/builder/types';

/**
 * 클라이언트 컴포넌트에서 안전하게 import할 수 있는 순수 타입 전용 모듈.
 * Prisma/Elasticsearch 클라이언트를 끌어오는 서버 전용 서비스 코드
 * (src/lib/services/*, src/lib/db.ts, src/lib/elasticsearch.ts)는 브라우저 번들에
 * 포함되면 안 되므로, API 응답 형태만 여기에 별도로 선언해 재사용한다.
 */
export interface FormListItem {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  status: 'OPEN' | 'CLOSED';
  ownerName: string | null;
  deployUrl: string | null;
  viewCount: number;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionItem {
  formId: string;
  submissionId: string;
  submittedAt: string;
  data: Record<string, unknown>;
}

export interface AuditLogItem {
  id: string;
  time: string;
  userEmail: string;
  action: string;
  formId: string | null;
  target: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ShareRequestItem {
  id: string;
  formId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  fromUser: { id: string; name: string; email: string };
  toUser: { id: string; name: string; email: string };
  form: { id: string };
}

export interface DatabaseRightsInfo {
  producerName: string;
  completedAt: string;
  lastSubstantialUpdate: string;
  investmentDescription: string;
  protectionExpiresAt: string;
  recentUpdates: Array<{ occurredAt: string; scope: string; description: string; performedBy: string }>;
}
