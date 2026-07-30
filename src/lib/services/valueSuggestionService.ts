import { getFormTemplate, suggestFieldValues as esSuggestFieldValues } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import { shouldMaskForm } from './maskingService';

/**
 * 값 사전 제안(데이터 정확성 §5 순위4, docs/데이터품질-검증구간-설계.md §3-3) — 응답자가
 * 입력하는 동안 같은 문항에 과거 들어온 값 중 비슷한 것을 빈도순으로 보여준다("한국산업(주)"
 * "(주)한국산업"처럼 같은 대상을 다르게 적는 문제를 입력 시점에 줄인다).
 *
 * 대상을 의도적으로 좁힌다:
 *  - `text` 타입만. 장문형은 자유서술이라 "값 하나"로 묶이는 개념 자체가 안 맞고,
 *    정규식 입력은 이미 형식이 고정돼 있어 사전 제안이 필요 없다.
 *  - 익명 문항 제외 — 익명 응답은 별도 인덱스에 셔플 저장되어 이 조회 대상이 아니다.
 *  - 개인식별자 문항 제외 — "OO님도 이렇게 입력했어요"가 실질적으로 그 사람이 응답했다는
 *    사실을 흘리는 것과 같다(이름·사번 등).
 *  - 마스킹 대상 폼 전체 제외 — 이 기능은 정의상 과거 자유서술 값을 원문 그대로 노출하므로,
 *    워드클라우드·품질 대시보드와 같은 원칙(마스킹된 폼은 원문 집계/비교 금지)을 그대로 적용한다.
 */
const MIN_QUERY_LENGTH = 1;
const MAX_SUGGESTIONS = 6;

export async function suggestValues(formId: string, fieldId: string, rawQuery: string): Promise<string[]> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const [template, registry] = await Promise.all([
    getFormTemplate(formId),
    prisma.formRegistry.findUnique({
      where: { id: formId },
      select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
    }),
  ]);
  if (!template || !registry) return [];
  if (shouldMaskForm(registry)) return [];

  const field = template.fields.find((f) => f.id === fieldId);
  if (!field) return [];
  if (field.type !== 'text') return [];
  if (field.anonymous || field.personalIdentifier) return [];

  const suggestions = await esSuggestFieldValues(formId, fieldId, query, MAX_SUGGESTIONS);
  return suggestions.map((s) => s.value);
}
