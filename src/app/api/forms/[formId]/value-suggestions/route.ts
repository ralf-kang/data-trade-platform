import { NextRequest, NextResponse } from 'next/server';
import { suggestValues } from '@/lib/services/valueSuggestionService';

type Params = { params: Promise<{ formId: string }> };

/**
 * 응답 화면(비로그인 방문자 포함)에서 입력 중 호출하는 값 사전 제안.
 * 별도 신원 확인이 필요 없다 — 어떤 값이 제안되는지 자체가 민감 정보는 아니고, 서비스
 * 계층(valueSuggestionService)에서 익명/개인식별/마스킹 대상 문항은 이미 걸러진다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get('fieldId');
  const q = searchParams.get('q') ?? '';
  if (!fieldId) return NextResponse.json({ suggestions: [] });

  const suggestions = await suggestValues(formId, fieldId, q);
  return NextResponse.json({ suggestions });
}
