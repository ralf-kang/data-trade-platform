import { prisma } from '@/lib/db';
import {
  getFormTemplate,
  getFieldValueCounts,
  countFormSubmissions,
  findSubmissionByFieldValue,
} from '@/lib/elasticsearch';
import { shouldMaskForm } from './maskingService';
import { logAudit } from './auditService';
import type { ActingUser } from '@/lib/auth';
import type { FormLinkCardinality, Prisma } from '@/generated/prisma/client';

/**
 * 양식지 간 관계(온톨로지) — 사용자가 두 양식지의 문항이 같은 키값을 담고 있는지
 * 테스트하고 선언하는 기능. (docs/양식지-관계-온톨로지-설계.md)
 *
 * ★ 이 기능은 구조적으로 재식별 도구다 — 매치 건수·매치율만으로도 k=1을 드러낼 수 있다.
 * 그래서 모든 발견 단계 함수는 k 하한(§S3)을 통과해야만 정확한 수치를 돌려주고,
 * 시도 자체를 감사 로그에 남긴다(§S7 — 연결을 만들지 않고 "테스트만" 한 것도 로깅).
 */

const K_THRESHOLD = 5; // §5-1 확정 — 워드클라우드 설계서와 동일한 값

export interface NormalizationOptions {
  trim?: boolean;
  stripSeparators?: boolean; // 하이픈, 공백 등 구분자 제거
  lowercase?: boolean;
  stripLeadingZero?: boolean;
  nfc?: boolean; // 한글 자모 정규화 (macOS NFD ↔ Windows NFC)
}

function normalizeValue(raw: string, opts: NormalizationOptions): string {
  let v = raw;
  if (opts.nfc) v = v.normalize('NFC');
  if (opts.trim) v = v.trim().replace(/\s+/g, ' ');
  if (opts.stripSeparators) v = v.replace(/[-_\s.]/g, '');
  if (opts.lowercase) v = v.toLowerCase();
  if (opts.stripLeadingZero) v = v.replace(/^0+(?=\d)/, '');
  return v;
}

interface FieldRef {
  formId: string;
  fieldId: string;
}

interface FieldMeta {
  type: string;
  rawType: boolean;
  label: string;
  anonymous: boolean;
  personalIdentifier: boolean;
  masked: boolean;
}

async function getFieldMeta(ref: FieldRef): Promise<FieldMeta | null> {
  const [template, registry] = await Promise.all([
    getFormTemplate(ref.formId),
    prisma.formRegistry.findUnique({
      where: { id: ref.formId },
      select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
    }),
  ]);
  const field = template?.fields.find((f) => f.id === ref.fieldId);
  if (!field) return null;
  return {
    type: field.type,
    rawType: field.type === 'number' || field.type === 'date',
    label: field.label,
    anonymous: !!field.anonymous,
    personalIdentifier: !!field.personalIdentifier,
    masked: !!registry && shouldMaskForm(registry),
  };
}

export interface ConnectionTestResult {
  blocked: boolean;
  blockedReason?: 'BELOW_K' | 'ANONYMOUS_FIELD';
  leftUniqueCount?: number;
  rightUniqueCount?: number;
  intersectionCount?: number;
  leftOnlyCount?: number;
  rightOnlyCount?: number;
  leftContainmentPct?: number; // 교집합 / 좌측 고유값
  rightContainmentPct?: number;
  suggestedCardinality?: FormLinkCardinality;
  isPersonalKey: boolean;
}

/**
 * ★ 연결 테스트 — 이 기능의 핵심(§2-2). S1(익명 문항 배제)·S3(k-익명성 하한)를 여기서 강제한다.
 * 테스트 시도 자체를 감사 로그에 남긴다(S7) — 연결을 저장하지 않아도 기록된다.
 */
export async function testConnection(
  left: FieldRef,
  right: FieldRef,
  normalization: NormalizationOptions,
  actor: ActingUser
): Promise<ConnectionTestResult> {
  const [leftMeta, rightMeta] = await Promise.all([getFieldMeta(left), getFieldMeta(right)]);
  const isPersonalKey = !!(leftMeta?.personalIdentifier || rightMeta?.personalIdentifier);

  if (!leftMeta || !rightMeta || leftMeta.anonymous || rightMeta.anonymous) {
    return { blocked: true, blockedReason: 'ANONYMOUS_FIELD', isPersonalKey };
  }

  const [leftTotal, rightTotal, leftCounts, rightCounts] = await Promise.all([
    countFormSubmissions(left.formId),
    countFormSubmissions(right.formId),
    getFieldValueCounts(left.formId, left.fieldId, leftMeta.rawType),
    getFieldValueCounts(right.formId, right.fieldId, rightMeta.rawType),
  ]);

  await logAudit({
    userEmail: actor.email,
    action: 'FORM_LINK_TEST',
    target: `FormLink [${left.formId}.${left.fieldId} <-> ${right.formId}.${right.fieldId}]`,
    details: `연결 테스트 시도 (개인식별자: ${isPersonalKey ? 'Y' : 'N'})`,
    severity: isPersonalKey ? 'warning' : 'info',
  });

  // S3 — 응답이 너무 적으면(k 미만) 애초에 통계를 낼 근거가 없다고 본다.
  if (leftTotal < K_THRESHOLD || rightTotal < K_THRESHOLD) {
    return { blocked: true, blockedReason: 'BELOW_K', isPersonalKey };
  }

  const leftNorm = new Map<string, Set<string>>(); // normalized -> raw values
  for (const { value } of leftCounts) {
    const n = normalizeValue(value, normalization);
    if (!leftNorm.has(n)) leftNorm.set(n, new Set());
    leftNorm.get(n)!.add(value);
  }
  const rightNorm = new Map<string, Set<string>>();
  for (const { value } of rightCounts) {
    const n = normalizeValue(value, normalization);
    if (!rightNorm.has(n)) rightNorm.set(n, new Set());
    rightNorm.get(n)!.add(value);
  }

  const leftUniqueCount = leftNorm.size;
  const rightUniqueCount = rightNorm.size;
  let intersectionCount = 0;
  for (const key of leftNorm.keys()) {
    if (rightNorm.has(key)) intersectionCount += 1;
  }

  // S3 — 교집합 자체가 k 미만이면 "몇 건 겹치는지"를 정확히 알려주는 것 자체가 위험하다.
  if (intersectionCount > 0 && intersectionCount < K_THRESHOLD) {
    return { blocked: true, blockedReason: 'BELOW_K', isPersonalKey };
  }

  const leftOnlyCount = leftUniqueCount - intersectionCount;
  const rightOnlyCount = rightUniqueCount - intersectionCount;
  const leftContainmentPct = leftUniqueCount === 0 ? 0 : intersectionCount / leftUniqueCount;
  const rightContainmentPct = rightUniqueCount === 0 ? 0 : intersectionCount / rightUniqueCount;

  // 유일성 비율로 카디널리티 제안 — Power BI 방식(자동 확정은 하지 않고 제안만).
  const leftUniqueness = leftTotal === 0 ? 0 : leftUniqueCount / leftTotal;
  const rightUniqueness = rightTotal === 0 ? 0 : rightUniqueCount / rightTotal;
  let suggestedCardinality: FormLinkCardinality = 'MANY_TO_MANY';
  if (leftUniqueness > 0.95 && rightUniqueness > 0.95) suggestedCardinality = 'ONE_TO_ONE';
  else if (rightUniqueness > 0.95) suggestedCardinality = 'MANY_TO_ONE';
  else if (leftUniqueness > 0.95) suggestedCardinality = 'ONE_TO_MANY';

  return {
    blocked: false,
    leftUniqueCount,
    rightUniqueCount,
    intersectionCount,
    leftOnlyCount,
    rightOnlyCount,
    leftContainmentPct,
    rightContainmentPct,
    suggestedCardinality,
    isPersonalKey,
  };
}

export interface PreviewRow {
  leftSubmissionId: string;
  leftValue: string;
  rightSubmissionId: string;
  rightValue: string;
}

export interface PreviewResult {
  blocked: boolean;
  blockedReason?: 'BELOW_K' | 'MASKED' | 'ANONYMOUS_FIELD';
  rows: PreviewRow[];
}

const MASK_DISPLAY = '••••• (마스킹됨)';
function blurValue(value: string, isPersonalKey: boolean): string {
  if (!isPersonalKey) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

/**
 * 엣지/노드 호버 팝오버(§2-2 step 5) — 최근 레코드 5건 이하. 구조 확인용이지 레코드
 * 열람용이 아니다. S3(k 미만 차단)·S5(개인식별자 블러)·S6(마스킹 전파) 전부 여기서 강제.
 */
export async function previewFormLinkMatches(
  left: FieldRef,
  right: FieldRef,
  normalization: NormalizationOptions
): Promise<PreviewResult> {
  const [leftMeta, rightMeta] = await Promise.all([getFieldMeta(left), getFieldMeta(right)]);
  if (!leftMeta || !rightMeta || leftMeta.anonymous || rightMeta.anonymous) {
    return { blocked: true, blockedReason: 'ANONYMOUS_FIELD', rows: [] };
  }
  // S6 — 양쪽 중 더 엄격한 쪽을 따른다. 마스킹 대상 폼이 하나라도 있으면 미리보기 전체를 막는다.
  if (leftMeta.masked || rightMeta.masked) {
    return { blocked: true, blockedReason: 'MASKED', rows: [] };
  }

  const isPersonalKey = leftMeta.personalIdentifier || rightMeta.personalIdentifier;
  const [leftCounts, rightCounts] = await Promise.all([
    getFieldValueCounts(left.formId, left.fieldId, leftMeta.rawType),
    getFieldValueCounts(right.formId, right.fieldId, rightMeta.rawType),
  ]);

  const leftNorm = new Map<string, string[]>();
  for (const { value } of leftCounts) {
    const n = normalizeValue(value, normalization);
    if (!leftNorm.has(n)) leftNorm.set(n, []);
    leftNorm.get(n)!.push(value);
  }
  const rightNorm = new Map<string, string[]>();
  for (const { value } of rightCounts) {
    const n = normalizeValue(value, normalization);
    if (!rightNorm.has(n)) rightNorm.set(n, []);
    rightNorm.get(n)!.push(value);
  }

  const matchedKeys = [...leftNorm.keys()].filter((k) => rightNorm.has(k));
  if (matchedKeys.length < K_THRESHOLD) {
    return { blocked: true, blockedReason: 'BELOW_K', rows: [] };
  }

  const rows: PreviewRow[] = [];
  for (const key of matchedKeys.slice(0, 5)) {
    const leftRaw = leftNorm.get(key)![0];
    const rightRaw = rightNorm.get(key)![0];
    const [leftDoc, rightDoc] = await Promise.all([
      findSubmissionByFieldValue(left.formId, left.fieldId, leftMeta.rawType, leftRaw),
      findSubmissionByFieldValue(right.formId, right.fieldId, rightMeta.rawType, rightRaw),
    ]);
    if (!leftDoc || !rightDoc) continue;
    rows.push({
      leftSubmissionId: leftDoc.submissionId,
      leftValue: blurValue(leftRaw, isPersonalKey),
      rightSubmissionId: rightDoc.submissionId,
      rightValue: blurValue(rightRaw, isPersonalKey),
    });
  }

  return { blocked: false, rows };
}

// ---------------------------------------------------------------------------
// FormLink CRUD — §2-1/2-3. 슈퍼관리자 전용(§5-2), 접근 통제는 API 레이어(requireSuperAdmin)에서.
// ---------------------------------------------------------------------------

export interface CreateFormLinkInput {
  leftFormId: string;
  leftFieldId: string;
  rightFormId: string;
  rightFieldId: string;
  name: string;
  reverseName: string;
  cardinality: FormLinkCardinality;
  normalization: NormalizationOptions;
  description?: string;
}

export async function createFormLink(input: CreateFormLinkInput, actor: ActingUser) {
  const [leftMeta, rightMeta] = await Promise.all([
    getFieldMeta({ formId: input.leftFormId, fieldId: input.leftFieldId }),
    getFieldMeta({ formId: input.rightFormId, fieldId: input.rightFieldId }),
  ]);
  if (!leftMeta || !rightMeta || leftMeta.anonymous || rightMeta.anonymous) {
    throw new Error('ANONYMOUS_FIELD');
  }
  const isPersonalKey = leftMeta.personalIdentifier || rightMeta.personalIdentifier;

  const link = await prisma.formLink.create({
    data: {
      leftFormId: input.leftFormId,
      leftFieldId: input.leftFieldId,
      rightFormId: input.rightFormId,
      rightFieldId: input.rightFieldId,
      name: input.name,
      reverseName: input.reverseName,
      cardinality: input.cardinality,
      normalization: input.normalization as unknown as Prisma.InputJsonValue,
      isPersonalKey,
      description: input.description,
      createdBy: actor.email,
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'FORM_LINK_CREATE',
    target: `FormLink [${link.id}]`,
    details: `양식지 관계 생성: ${input.name} (${input.leftFormId}.${input.leftFieldId} <-> ${input.rightFormId}.${input.rightFieldId})`,
    severity: isPersonalKey ? 'warning' : 'info',
  });

  return link;
}

export async function listFormLinks() {
  return prisma.formLink.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function deleteFormLink(id: string, actor: ActingUser) {
  const link = await prisma.formLink.delete({ where: { id } });
  await logAudit({
    userEmail: actor.email,
    action: 'FORM_LINK_DELETE',
    target: `FormLink [${id}]`,
    details: `양식지 관계 삭제: ${link.name}`,
    severity: 'info',
  });
  return link;
}

// ---------------------------------------------------------------------------
// 최초 이용 안내 · 동의 (§2-5) — privacyWarningAck + AuditLog와 같은 패턴 재사용.
// ---------------------------------------------------------------------------

export async function getOntologyConsentStatus(actor: ActingUser): Promise<{ consentedAt: string | null }> {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { ontologyConsentAt: true } });
  return { consentedAt: user?.ontologyConsentAt?.toISOString() ?? null };
}

export async function ackOntologyConsent(actor: ActingUser): Promise<void> {
  await prisma.user.update({ where: { id: actor.id }, data: { ontologyConsentAt: new Date() } });
  await logAudit({
    userEmail: actor.email,
    action: 'ONTOLOGY_CONSENT_ACK',
    target: `User [${actor.email}]`,
    details: '양식지 관계(온톨로지) 캔버스 재식별 위험 안내 확인',
    severity: 'info',
  });
}

/** 슈퍼관리자의 "옵션 상세화면"용 — 개인정보 처리와 마찬가지로 관리자 계정들의 동의 상태를 조회. */
export async function listOntologyConsents() {
  const admins = await prisma.user.findMany({
    where: { roles: { some: { role: 'PLATFORM_ADMIN', scopeFormId: null } } },
    select: { id: true, email: true, name: true, ontologyConsentAt: true },
    orderBy: { email: 'asc' },
  });
  return admins.map((a) => ({
    userId: a.id,
    email: a.email,
    name: a.name,
    consentedAt: a.ontologyConsentAt?.toISOString() ?? null,
  }));
}
