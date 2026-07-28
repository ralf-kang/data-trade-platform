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
  ownerId: string | null;
  ownerName: string | null;
  deployUrl: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  lifecycle: 'DRAFT' | 'PUBLISHED';
  schemaVersion: number;
  publishedAt: string | null;
  // /api/forms?withAccess=1 에서만 채워짐 (데이터 허브 화면 전용).
  dataAccess?: 'owner' | 'shared' | 'super-admin' | 'none';
}

export interface ApiKeyItem {
  id: string;
  formId: string;
  name: string;
  keyPrefix: string;
  scope: 'READ' | 'WRITE' | 'READ_WRITE';
  rateLimitPerMin: number;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  createdBy: string;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  orgName: string | null;
  isActive: boolean;
  canBulkExport: boolean;
  createdAt: string;
  _count: { formsOwned: number };
}

export interface NotificationItem {
  id: string;
  formId: string | null;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  createdAt: string;
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

export interface MeInfo {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  canBulkExport: boolean;
}

export interface DatabaseRightsInfo {
  producerName: string;
  completedAt: string;
  lastSubstantialUpdate: string;
  investmentDescription: string;
  protectionExpiresAt: string;
  recentUpdates: Array<{ occurredAt: string; scope: string; description: string; performedBy: string }>;
}
