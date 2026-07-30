import { findSimilarFormTemplates } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';

/**
 * 비슷한 양식지 추천(docs/데이터품질-검증구간-설계.md §3-4 — "비슷한 양식지를 템플릿으로
 * 추천"). 제작자가 새 양식을 만들기 시작할 때 "이런 양식이 이미 있습니다"를 보여줘
 * 부서마다 비슷한 양식을 또 만드는 낭비를 줄인다.
 *
 * 확정(PUBLISHED)된 양식지만 추천한다 — 다른 사람의 초안(DRAFT)은 아직 완성되지 않은
 * 목적을 가진 개인 작업일 수 있어, 제목만으로 다른 관리자에게 노출하지 않는다.
 */
export interface SimilarFormSuggestion {
  formId: string;
  title: string;
  description: string;
  fieldCount: number;
}

export async function suggestSimilarForms(
  title: string,
  fieldLabels: string[],
  excludeFormId?: string
): Promise<SimilarFormSuggestion[]> {
  if (!title.trim() && fieldLabels.length === 0) return [];

  const candidates = await findSimilarFormTemplates(title, fieldLabels, excludeFormId, 8);
  if (candidates.length === 0) return [];

  const published = await prisma.formRegistry.findMany({
    where: { id: { in: candidates.map((c) => c.formId) }, lifecycle: 'PUBLISHED' },
    select: { id: true },
  });
  const publishedIds = new Set(published.map((p) => p.id));

  return candidates.filter((c) => publishedIds.has(c.formId)).slice(0, 3);
}
