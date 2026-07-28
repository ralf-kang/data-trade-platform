import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import {
  bulkCreateSubmissions,
  findExistingExternalIds,
  getFormTemplate,
  type SubmissionDocument,
} from '@/lib/elasticsearch';
import { logAudit } from '@/lib/services/auditService';
import { notifyFormOwner } from '@/lib/services/notificationService';
import type { FormField } from '@/components/builder/types';

/**
 * 외부 API를 통한 제출 데이터 대량 입력.
 *
 * 설계 의도:
 *  - **부분 수용(lenient)**: 1,000건 중 3건이 잘못됐다고 전체를 되돌리면 연동 측이
 *    재시도 지옥에 빠진다. 기본은 유효한 행만 적재하고 행별 결과를 돌려준다.
 *  - **전량 거부(strict)**: 회계·정산처럼 부분 적재가 위험한 경우를 위해 옵션 제공.
 *  - **멱등성**: externalId가 이미 있으면 duplicate로 건너뛴다. 네트워크 타임아웃 후
 *    같은 배치를 재전송해도 중복 적재되지 않는다.
 *  - **비정형 활용**: 폼에 정의되지 않은 여분 키도 버리지 않고 `data`에 그대로 담는다
 *    (Elasticsearch dynamic mapping). 폼 설계가 아직 진행 중이거나 연동 측이 먼저
 *    필드를 보내는 상황에서 데이터 유실을 막는다 — 대신 `unknownFields`로 알려준다.
 */

export type IngestMode = 'lenient' | 'strict';

export interface IngestRowInput {
  /** 외부 시스템의 고유 키 (선택, 멱등성 판정에 사용) */
  externalId?: string;
  /** 필드 id → 값. 폼에 없는 키도 허용되며 unknownFields로 보고된다. */
  data: Record<string, unknown>;
  /** 제출 시각을 외부 시스템 기준으로 지정 (선택, 기본 현재시각) */
  submittedAt?: string;
}

export type IngestRowStatus = 'accepted' | 'rejected' | 'duplicate';

export interface IngestRowResult {
  index: number;
  status: IngestRowStatus;
  submissionId?: string;
  externalId?: string;
  errors?: string[];
  unknownFields?: string[];
}

export interface IngestResult {
  mode: IngestMode;
  schemaVersion: number;
  total: number;
  accepted: number;
  rejected: number;
  duplicate: number;
  results: IngestRowResult[];
}

/** 한 행을 폼 필드 정의에 비추어 검증한다. */
function validateRow(
  fields: FormField[],
  data: Record<string, unknown>
): { errors: string[]; unknownFields: string[] } {
  const errors: string[] = [];
  const knownIds = new Set(fields.map((f) => f.id));
  const unknownFields = Object.keys(data).filter((k) => !knownIds.has(k));

  for (const field of fields) {
    const value = data[field.id];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors.push(`필수 항목 누락: ${field.id} (${field.label})`);
      continue;
    }
    if (isEmpty) continue;

    if (field.regexPattern && typeof value === 'string') {
      try {
        if (!new RegExp(field.regexPattern).test(value)) {
          errors.push(`형식 불일치: ${field.id} (${field.label}) = "${value}"`);
        }
      } catch {
        // 저장된 패턴 자체가 잘못된 경우는 검증을 건너뛴다.
      }
    }
    if (field.type === 'number' && typeof value !== 'number' && Number.isNaN(Number(value))) {
      errors.push(`숫자 형식 오류: ${field.id} (${field.label}) = "${String(value)}"`);
    }
    if (
      (field.type === 'select' || field.type === 'radio') &&
      field.options?.length &&
      typeof value === 'string' &&
      !field.options.includes(value)
    ) {
      errors.push(
        `허용되지 않은 선택지: ${field.id} (${field.label}) = "${value}" (허용: ${field.options.join(', ')})`
      );
    }
  }

  return { errors, unknownFields };
}

export async function ingestSubmissions(
  formId: string,
  rows: IngestRowInput[],
  opts: { mode?: IngestMode; apiKeyPrefix: string }
): Promise<IngestResult> {
  const mode: IngestMode = opts.mode ?? 'lenient';

  const [registry, template] = await Promise.all([
    prisma.formRegistry.findUnique({ where: { id: formId } }),
    getFormTemplate(formId),
  ]);
  if (!registry) throw new Error('FORM_NOT_FOUND');
  if (!template) throw new Error('FORM_TEMPLATE_NOT_FOUND');
  // 확정되지 않은(DRAFT) 양식지는 필드 구성이 계속 바뀌므로 외부 입력을 받지 않는다.
  if (registry.lifecycle !== 'PUBLISHED') throw new Error('FORM_NOT_PUBLISHED');

  // 멱등성: 이미 적재된 externalId 조회
  const incomingExternalIds = rows
    .map((r) => r.externalId)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const existing = await findExistingExternalIds(formId, incomingExternalIds);

  // 같은 배치 안의 중복도 걸러낸다.
  const seenInBatch = new Set<string>();

  const results: IngestRowResult[] = [];
  const toInsert: SubmissionDocument[] = [];

  rows.forEach((row, index) => {
    const externalId = row.externalId;

    if (externalId && (existing.has(externalId) || seenInBatch.has(externalId))) {
      results.push({ index, status: 'duplicate', externalId });
      return;
    }

    const { errors, unknownFields } = validateRow(template.fields, row.data ?? {});
    if (errors.length > 0) {
      results.push({ index, status: 'rejected', externalId, errors, unknownFields: unknownFields.length ? unknownFields : undefined });
      return;
    }

    const submissionId = `SUB-${randomUUID().slice(0, 8).toUpperCase()}`;
    if (externalId) seenInBatch.add(externalId);
    toInsert.push({
      formId,
      submissionId,
      submittedAt: row.submittedAt ?? new Date().toISOString(),
      data: row.data ?? {},
      externalId,
      source: 'api',
      schemaVersion: registry.schemaVersion,
    });
    results.push({
      index,
      status: 'accepted',
      submissionId,
      externalId,
      unknownFields: unknownFields.length ? unknownFields : undefined,
    });
  });

  const rejectedCount = results.filter((r) => r.status === 'rejected').length;

  // strict 모드: 한 건이라도 실패하면 아무것도 적재하지 않는다.
  if (mode === 'strict' && rejectedCount > 0) {
    return {
      mode,
      schemaVersion: registry.schemaVersion,
      total: rows.length,
      accepted: 0,
      rejected: rejectedCount,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      results: results.map((r) =>
        r.status === 'accepted'
          ? { ...r, status: 'rejected' as const, submissionId: undefined, errors: ['strict 모드: 동일 배치 내 다른 행의 오류로 전량 거부됨'] }
          : r
      ),
    };
  }

  if (toInsert.length > 0) {
    await bulkCreateSubmissions(toInsert);
    await prisma.formRegistry
      .update({ where: { id: formId }, data: { submissionCount: { increment: toInsert.length } } })
      .catch(() => undefined);
  }

  await logAudit({
    userEmail: `api-key(${opts.apiKeyPrefix}...)`,
    action: 'DATA_API_INGEST',
    target: `Form [${formId}]`,
    details: `외부 API 대량 입력 — 총 ${rows.length}건 (수용 ${toInsert.length} / 거부 ${rejectedCount} / 중복 ${results.filter((r) => r.status === 'duplicate').length}, mode=${mode})`,
    severity: rejectedCount > 0 ? 'warning' : 'info',
    formId,
  });

  // 거부된 행이 있으면 소유자에게 알린다 (연동 오류를 방치하지 않도록).
  if (rejectedCount > 0 && registry.ownerId) {
    await notifyFormOwner({
      userId: registry.ownerId,
      formId,
      type: 'API_INGEST_REJECTED',
      message: `[${template.title}] 외부 API 대량 입력에서 ${rejectedCount}건이 검증 실패로 거부되었습니다.`,
      severity: 'warning',
    });
  }

  return {
    mode,
    schemaVersion: registry.schemaVersion,
    total: rows.length,
    accepted: toInsert.length,
    rejected: rejectedCount,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
    results,
  };
}
