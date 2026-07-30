import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { suggestSimilarForms } from '@/lib/services/templateRecommendationService';

/** 양식 편집기(제작자)용 — 제목/문항 라벨을 넘기면 비슷한 기존 양식지를 추천한다. */
export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? '';
  const labels = searchParams.getAll('label');
  const excludeFormId = searchParams.get('excludeFormId') ?? undefined;

  const suggestions = await suggestSimilarForms(title, labels, excludeFormId);
  return NextResponse.json({ suggestions });
}
