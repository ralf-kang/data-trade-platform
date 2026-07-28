import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';
import type { AdminUser, ApiKey, ApiScope } from '@/generated/prisma/client';

/**
 * 외부 연동용 API 키 관리.
 *
 * 원문 키는 DB에 저장하지 않는다 — 생성 시 1회만 호출자에게 돌려주고, 이후에는
 * SHA-256 해시로만 검증한다(유출 시 피해 최소화). 목록 화면에서 키를 식별할 수 있도록
 * 접두 8자만 평문으로 남긴다.
 */

const KEY_PREFIX = 'wre_'; // web-report-editor

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreateApiKeyResult {
  record: ApiKey;
  /** 원문 키 — 이 순간 이후로는 다시 조회할 수 없다. */
  plaintextKey: string;
}

export async function createApiKey(
  input: {
    formId: string;
    name: string;
    scope: ApiScope;
    rateLimitPerMin?: number;
    expiresAt?: Date | null;
  },
  actor: AdminUser
): Promise<CreateApiKeyResult> {
  const plaintextKey = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  const record = await prisma.apiKey.create({
    data: {
      formId: input.formId,
      name: input.name,
      keyPrefix: plaintextKey.slice(0, 12),
      keyHash: hashApiKey(plaintextKey),
      scope: input.scope,
      rateLimitPerMin: input.rateLimitPerMin ?? 60,
      expiresAt: input.expiresAt ?? null,
      createdBy: actor.email,
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'API_KEY_CREATE',
    target: `Form [${input.formId}] ApiKey [${record.keyPrefix}...]`,
    details: `외부 연동 API 키 발급 (${input.name}, scope=${input.scope})`,
    severity: 'warning',
    formId: input.formId,
  });

  return { record, plaintextKey };
}

export async function listApiKeys(formId: string) {
  return prisma.apiKey.findMany({
    where: { formId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeApiKey(id: string, actor: AdminUser) {
  const key = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  await logAudit({
    userEmail: actor.email,
    action: 'API_KEY_REVOKE',
    target: `Form [${key.formId}] ApiKey [${key.keyPrefix}...]`,
    details: `외부 연동 API 키 폐기 (${key.name})`,
    severity: 'warning',
    formId: key.formId,
  });
  return key;
}

export interface VerifiedApiKey {
  key: ApiKey;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Authorization: Bearer <key> 헤더를 검증한다.
 * 유효하지 않으면 null (호출부에서 401 처리).
 */
export async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(rawKey) } });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;

  // 사용 이력 기록 — 실패해도 요청 자체를 막지 않는다(부가 통계).
  await prisma.apiKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    })
    .catch(() => undefined);

  return {
    key,
    canRead: key.scope === 'READ' || key.scope === 'READ_WRITE',
    canWrite: key.scope === 'WRITE' || key.scope === 'READ_WRITE',
  };
}
