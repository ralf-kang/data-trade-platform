import { listSubmissions as esListSubmissions, getFormTemplate } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import { shouldMaskForm, maskSubmissionList } from './maskingService';

/**
 * 워드클라우드 — 자유서술형 응답에서 자주 등장하는 단어를 시각화한다.
 *
 * 자유서술(text/textarea/regex-input)은 마스킹 계층(maskingService)이 항상 마스킹
 * 대상으로 보는 바로 그 필드 타입이다. "화면에서만 가리면 API로 우회된다"는 원칙과
 * 대칭으로, 워드클라우드도 별도 우회 경로가 되지 않도록 반드시 masking을 거친
 * 데이터에서만 단어를 뽑는다 — shouldMaskForm(registry)이 true인 폼은 원문 대신
 * 마스킹 플레이스홀더만 보게 되므로, 아래 토큰화 단계에서 그 플레이스홀더 문구를
 * 걸러내 워드클라우드에 "마스킹됨" 같은 가짜 단어가 섞이지 않게 한다.
 *
 * 형태소 분석기가 없어 공백 기준으로만 나눈다 — 한국어 조사가 단어에 붙어 있으면
 * (예: "품질이") 분리되지 않는 한계가 있다. 정밀 분석이 필요해지면 형태소 분석기
 * 도입을 검토할 것.
 */

const FREE_TEXT_TYPES = new Set(['text', 'textarea', 'regex-input']);
const SCAN_PAGE_SIZE = 200;
// CSV 추출(EXPORT_HARD_CAP=5000)보다 낮게 잡는다 — 워드클라우드는 빈도의 통계적
// 근사치면 충분하고, 전수 스캔은 화면 반응성 대비 이득이 적다.
const SCAN_HARD_CAP = 2000;
const MAX_WORDS = 80;
const MIN_WORD_LENGTH = 2;

const REDACTION_MARKERS = ['마스킹됨', '다른 응답값과의 조합'];

const STOPWORDS = new Set([
  // 한국어 — 독립된 토큰으로 떨어지는 흔한 불용어(조사 결합형까지는 못 거름)
  '그리고', '그러나', '하지만', '그래서', '그런데', '합니다', '입니다', '있습니다', '없습니다',
  '이것', '저것', '그것', '너무', '정말', '매우', '조금', '많이', '그냥', '아주',
  '등', '및', '경우', '관련', '대한', '통해', '때문에', '같은', '만약', '위해',
  '이', '가', '은', '는', '을', '를', '의', '에', '와', '과', '도', '만', '로', '으로',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'to', 'of',
  'in', 'on', 'for', 'with', 'this', 'that', 'it', 'as', 'at', 'by', 'from',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.!?;:()[\]{}"'“”‘’…/\\|~`@#$%^&*+=<>_-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_WORD_LENGTH);
}

export interface WordCloudEntry {
  text: string;
  count: number;
}

export interface WordCloudResult {
  words: WordCloudEntry[];
  /** 워드클라우드 계산에 실제로 쓰인 응답 수(스캔 상한에 걸리면 total보다 작을 수 있음). */
  sampledCount: number;
  totalCount: number;
  fieldsUsed: string[];
  masked: boolean;
}

export async function buildFormWordCloud(formId: string): Promise<WordCloudResult> {
  const [template, registry] = await Promise.all([
    getFormTemplate(formId),
    prisma.formRegistry.findUnique({
      where: { id: formId },
      select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
    }),
  ]);
  if (!template) return { words: [], sampledCount: 0, totalCount: 0, fieldsUsed: [], masked: false };

  // 익명 문항은 이 화면에서도 다루지 않는다 — 본인에게조차 보여주지 않는 원칙(§멤버
  // 경험 설계)과 동일하게, 관리자 화면이라 해도 예외를 두지 않는다.
  const freeTextFields = template.fields.filter((f) => !f.anonymous && FREE_TEXT_TYPES.has(f.type));
  if (freeTextFields.length === 0) {
    return { words: [], sampledCount: 0, totalCount: 0, fieldsUsed: [], masked: false };
  }

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

  const masked = !!registry && shouldMaskForm(registry);
  const items = masked ? await maskSubmissionList(formId, template.fields, collected) : collected;

  const freq = new Map<string, number>();
  for (const it of items) {
    for (const f of freeTextFields) {
      const value = it.data[f.id];
      if (typeof value !== 'string') continue;
      if (REDACTION_MARKERS.some((m) => value.includes(m))) continue;
      for (const token of tokenize(value)) {
        if (STOPWORDS.has(token)) continue;
        freq.set(token, (freq.get(token) ?? 0) + 1);
      }
    }
  }

  const words = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WORDS)
    .map(([text, count]) => ({ text, count }));

  return {
    words,
    sampledCount: items.length,
    totalCount: total,
    fieldsUsed: freeTextFields.map((f) => f.label),
    masked,
  };
}
