import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import {
  aggregateAnonField,
  bulkCreateAnonSubmissions,
  countAnonSubmissions,
  listAnonFreeText,
  type AnonymousSubmissionDocument,
} from '@/lib/elasticsearch';
import type { FormField } from '@/components/builder/types';

/**
 * 문항 단위 익명성(2단계).
 *
 * 보장 범위: "응답했다는 사실"은 남지만(참여 기록·보상의 근거), "무엇이라고 답했는지"는
 * 제작자·플랫폼 관리자를 포함해 누구도 응답자와 연결할 수 없다.
 *
 * 핵심 장치 세 가지:
 *   1. 분리 — 익명 문항은 식별 문서에 저장되지 않는다 (splitSubmission).
 *   2. 버퍼+셔플 — 즉시 색인하면 "저장 순서 = 응답 순서"가 되어 식별 문서의 제출
 *      시각과 나란히 놓는 것만으로 복원된다. k건을 모아 섞어서 적재한다.
 *   3. 읽기 게이트 — 결과 집합이 임계값(k) 미만이면 집계 자체를 거부한다.
 *      "기획팀에서 2점 준 사람"이 4명 중 하나면 사실상 실명이기 때문이다.
 */

// 시각 절삭 단위(ms) — 1시간. 정확한 제출 시각은 익명 경로 어디에도 남기지 않는다.
const BUCKET_MS = 60 * 60 * 1000;

export function truncateToBucket(date: Date): Date {
  return new Date(Math.floor(date.getTime() / BUCKET_MS) * BUCKET_MS);
}

// ---------------------------------------------------------------------------
// 분할
// ---------------------------------------------------------------------------

export interface SplitResult {
  /** 식별 문서에 저장될 일반 문항 응답 */
  identified: Record<string, unknown>;
  /** 익명 버퍼로 갈 익명 문항 응답 */
  anonymous: Record<string, unknown>;
  hasAnonymousFields: boolean;
}

/** 폼 필드 정의의 anonymous 플래그에 따라 응답을 두 조각으로 나눈다. 서버 전용. */
export function splitSubmission(fields: FormField[], data: Record<string, unknown>): SplitResult {
  const anonymousIds = new Set(fields.filter((f) => f.anonymous).map((f) => f.id));
  const identified: Record<string, unknown> = {};
  const anonymous: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (anonymousIds.has(key)) anonymous[key] = value;
    else identified[key] = value;
  }
  return { identified, anonymous, hasAnonymousFields: anonymousIds.size > 0 };
}

// ---------------------------------------------------------------------------
// 임계값
// ---------------------------------------------------------------------------

export async function getThreshold(formId: string): Promise<number> {
  const [form, config] = await Promise.all([
    prisma.formRegistry.findUnique({ where: { id: formId }, select: { anonymityThreshold: true } }),
    prisma.systemConfig.findUnique({ where: { id: 'default' } }),
  ]);
  return form?.anonymityThreshold ?? config?.defaultAnonymityThreshold ?? 5;
}

// ---------------------------------------------------------------------------
// 버퍼 적재 + flush
// ---------------------------------------------------------------------------

/**
 * 익명 조각을 버퍼에 넣고, 임계값에 도달했으면 즉시 flush한다.
 * 제출 트랜잭션과 분리되어 있어 flush 실패가 제출 자체를 실패시키지는 않는다 —
 * 버퍼에 남아 있으면 다음 제출 때 다시 시도된다.
 */
export async function bufferAnonymousPart(
  formId: string,
  anonymousData: Record<string, unknown>,
  schemaVersion: number
): Promise<void> {
  if (Object.keys(anonymousData).length === 0) return;

  await prisma.anonymousResponseBuffer.create({
    data: {
      formId,
      payloadEncrypted: encryptSecret(JSON.stringify(anonymousData)),
      bucketAt: truncateToBucket(new Date()),
      schemaVersion,
    },
  });

  const threshold = await getThreshold(formId);
  const count = await prisma.anonymousResponseBuffer.count({ where: { formId } });
  if (count >= threshold) {
    await flushBuffer(formId, false).catch((err) => {
      // flush 실패는 제출을 막지 않는다 — 다음 기회에 재시도된다.
      console.warn(`[anonymity] flush 실패 (form=${formId}):`, (err as Error).message);
    });
  }
}

/**
 * 버퍼를 셔플해 익명 인덱스로 옮긴다.
 *
 * @param force 양식 마감 시 잔여분 처리 — 임계값 미만이어도 적재하되
 *              belowThreshold=true로 표시해 조회에서 제외한다.
 */
export async function flushBuffer(formId: string, force: boolean): Promise<number> {
  // 동시 flush 방지 — 같은 폼의 버퍼 행을 잠그고 진행한다.
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; payloadEncrypted: string; bucketAt: Date; schemaVersion: number }>>`
      SELECT id, "payloadEncrypted", "bucketAt", "schemaVersion"
      FROM anonymous_response_buffer WHERE "formId" = ${formId}
      FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return 0;

    const threshold = await getThreshold(formId);
    const below = rows.length < threshold;
    if (below && !force) return 0; // 아직 모자람 — 대기

    // Fisher–Yates 셔플: 적재 순서가 제출 순서를 암시하지 않게 한다.
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const docs: AnonymousSubmissionDocument[] = shuffled.map((row) => ({
      anonId: randomUUID(),
      formId,
      bucketAt: row.bucketAt.toISOString(),
      schemaVersion: row.schemaVersion,
      data: JSON.parse(decryptSecret(row.payloadEncrypted)) as Record<string, unknown>,
      belowThreshold: below,
    }));

    await bulkCreateAnonSubmissions(docs);
    await tx.anonymousResponseBuffer.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    return docs.length;
  });
}

// ---------------------------------------------------------------------------
// 조회 게이트 — 개별 반환 함수는 의도적으로 존재하지 않는다
// ---------------------------------------------------------------------------

export class BelowThresholdError extends Error {
  constructor(public readonly required: number) {
    super('BELOW_ANONYMITY_THRESHOLD');
  }
}

/**
 * 임계값 검사 후 집계를 반환한다.
 *
 * 주의: 정확한 현재 건수를 호출부에 노출하지 않는다 — "3건이라 못 봅니다"라고 알려주면
 * 조건을 바꿔가며 건수 변화를 관찰해 특정 인물의 응답 여부를 역추적할 수 있다.
 */
export async function getAnonAggregation(formId: string, field: FormField) {
  const threshold = await getThreshold(formId);
  const count = await countAnonSubmissions(formId);
  if (count < threshold) throw new BelowThresholdError(threshold);

  const isFreeText = field.type === 'textarea' || field.type === 'text';
  if (isFreeText) {
    return { kind: 'free-text' as const, values: await listAnonFreeText(formId, field.id) };
  }
  const { buckets } = await aggregateAnonField(formId, field.id);
  return { kind: 'buckets' as const, buckets };
}
