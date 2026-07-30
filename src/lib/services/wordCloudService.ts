import { getFormTemplate, aggregateNoriWordFrequency, analyzeWithNori, listSubmissions as esListSubmissions } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import { shouldMaskForm, maskSubmissionList } from './maskingService';
import { listForms } from './formService';
import type { ActingUser } from '@/lib/auth';

/**
 * 워드클라우드 — 자유서술형 응답에서 자주 등장하는 단어를 시각화한다.
 * (docs/워드클라우드-설계.md 참고 — §3의 구현 결함 수정 + §5의 외부 패키지 채택 반영판)
 *
 * 렌더링은 @isoterik/react-word-cloud, 한국어 형태소 분석은 Elasticsearch의
 * analysis-nori 플러그인(§5-2)에 맡긴다 — 이 서비스가 하는 일은 "어떤 범위의 데이터를,
 * 어떤 안전장치로 집계할 것인가"뿐이다.
 *
 * 두 갈래 경로:
 *  - **마스킹 대상이 아닌 폼**: ES가 색인 시점에 이미 `.nori` 서브필드로 형태소 분석까지
 *    마쳐 두었으므로, terms 집계 한 번으로 끝난다 (aggregateNoriWordFrequency).
 *  - **마스킹 대상 폼**: 원문이 색인된 그대로 집계하면 마스킹을 우회하게 되므로,
 *    반드시 마스킹을 거친 값만 꺼내(maskSubmissionList) 그 값을 `_analyze` API로
 *    토큰화한다(analyzeWithNori) — 색인을 거치지 않으므로 마스킹 우회가 아니다.
 * 두 경로 모두 "빈도 = 등장한 서로 다른 응답 수(document frequency)"로 통일해서 합산한다
 * (W1) — 한 사람의 반복이 클라우드를 왜곡하지 않고, k-익명성 게이트(W2)를 직접 걸 수 있다.
 */

const FREE_TEXT_TYPES = new Set(['text', 'textarea', 'regex-input']);
const SCAN_PAGE_SIZE = 200;
const SCAN_HARD_CAP = 2000;
const K_THRESHOLD = 5; // §워드클라우드-설계 §9-2 — 온톨로지 설계서와 동일한 값으로 확정
const DEFAULT_MAX_WORDS = 80;
const MIN_WORD_LENGTH = 2;

const REDACTION_MARKERS = ['마스킹됨', '다른 응답값과의 조합'];

const STOPWORDS = new Set([
  '그리고', '그러나', '하지만', '그래서', '그런데', '합니다', '입니다', '있습니다', '없습니다',
  '이것', '저것', '그것', '너무', '정말', '매우', '조금', '많이', '그냥', '아주',
  '등', '및', '경우', '관련', '대한', '통해', '때문', '같은', '만약', '위해',
]);

function isNoiseToken(token: string): boolean {
  if (token.length < MIN_WORD_LENGTH) return true;
  if (STOPWORDS.has(token)) return true;
  if (/^[0-9]+$/.test(token)) return true; // 순수 숫자열 — 개인식별자(전화번호 조각 등) 위험
  return false;
}

export interface WordCloudEntry {
  text: string;
  count: number;
}

export interface FormScopeOption {
  formId: string;
  title: string;
  fields: Array<{ id: string; label: string }>;
}

/** 범위 설정 툴바(§4-2)가 쓰는 목록 — 본인이 제작(소유)한 양식지 중 자유서술형 문항이 있는 것만. */
export async function listOwnedTextForms(actor: ActingUser): Promise<FormScopeOption[]> {
  const forms = await listForms({ ownerId: actor.id });
  return forms
    .map((f) => ({
      formId: f.id,
      title: f.title,
      fields: f.fields
        .filter((field) => !field.anonymous && FREE_TEXT_TYPES.has(field.type))
        .map((field) => ({ id: field.id, label: field.label })),
    }))
    .filter((f) => f.fields.length > 0);
}

export interface WordCloudScope {
  /** 대상 양식지 — "내가 만든 양식지 전체"면 여러 개, "특정 양식지"면 하나. */
  formIds: string[];
  /** formId -> 분석할 문항 id 목록. 지정하지 않은 폼은 모든 자유서술 문항을 쓴다. */
  fieldIdsByForm?: Record<string, string[]>;
}

export interface WordCloudResult {
  words: WordCloudEntry[];
  fieldsUsed: string[];
  formsUsed: string[];
  maskedForms: string[];
}

async function collectFastPath(formId: string, fieldId: string): Promise<Map<string, number>> {
  const buckets = await aggregateNoriWordFrequency([formId], fieldId, K_THRESHOLD, 200);
  const map = new Map<string, number>();
  for (const b of buckets) {
    if (isNoiseToken(b.term)) continue;
    map.set(b.term, (map.get(b.term) ?? 0) + b.docCount);
  }
  return map;
}

async function collectMaskedPath(
  formId: string,
  fieldId: string,
  template: { fields: Array<{ id: string; anonymous?: boolean; type: string }> }
): Promise<Map<string, number>> {
  const collected: Array<{ submissionId: string; campaignId?: string; data: Record<string, unknown> }> = [];
  let page = 1;
  let total = 0;
  while (collected.length < SCAN_HARD_CAP) {
    const result = await esListSubmissions({ formId, page, pageSize: SCAN_PAGE_SIZE });
    total = result.total;
    collected.push(...result.items.map((it) => ({ submissionId: it.submissionId, campaignId: it.campaignId, data: it.data })));
    if (result.items.length < SCAN_PAGE_SIZE || collected.length >= total) break;
    page += 1;
  }

  const masked = await maskSubmissionList(formId, template.fields as never, collected);

  // 응답 수(document frequency) 기준 — 한 응답 안에서 같은 단어가 여러 번 나와도 1로만 센다.
  const docFrequency = new Map<string, number>();
  for (const it of masked) {
    const value = it.data[fieldId];
    if (typeof value !== 'string') continue;
    if (REDACTION_MARKERS.some((m) => value.includes(m))) continue;
    const tokens = await analyzeWithNori(value);
    const uniqueInThisDoc = new Set(tokens.filter((t) => !isNoiseToken(t)));
    for (const token of uniqueInThisDoc) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
  }

  // k 게이트 — 마스킹 경로는 ES min_doc_count로 걸 수 없으므로 여기서 직접 적용한다.
  for (const [term, count] of docFrequency) {
    if (count < K_THRESHOLD) docFrequency.delete(term);
  }
  return docFrequency;
}

export async function buildWordCloud(scope: WordCloudScope, maxWords = DEFAULT_MAX_WORDS): Promise<WordCloudResult> {
  const merged = new Map<string, number>();
  const fieldsUsed = new Set<string>();
  const formsUsed: string[] = [];
  const maskedForms: string[] = [];

  for (const formId of scope.formIds) {
    const [template, registry] = await Promise.all([
      getFormTemplate(formId),
      prisma.formRegistry.findUnique({
        where: { id: formId },
        select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
      }),
    ]);
    if (!template) continue;

    const requestedFieldIds = scope.fieldIdsByForm?.[formId];
    const freeTextFields = template.fields.filter(
      (f) =>
        !f.anonymous &&
        FREE_TEXT_TYPES.has(f.type) &&
        (!requestedFieldIds || requestedFieldIds.includes(f.id))
    );
    if (freeTextFields.length === 0) continue;

    formsUsed.push(formId);
    const masked = !!registry && shouldMaskForm(registry);
    if (masked) maskedForms.push(formId);

    for (const field of freeTextFields) {
      fieldsUsed.add(field.label);
      const perFieldCounts = masked
        ? await collectMaskedPath(formId, field.id, template)
        : await collectFastPath(formId, field.id);
      for (const [term, count] of perFieldCounts) {
        merged.set(term, (merged.get(term) ?? 0) + count);
      }
    }
  }

  const words = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([text, count]) => ({ text, count }));

  return { words, fieldsUsed: [...fieldsUsed], formsUsed, maskedForms };
}
