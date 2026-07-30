import { NextRequest, NextResponse } from 'next/server';
import { suggestValues, suggestClusterValues } from '@/lib/services/valueSuggestionService';
import { resolveRespondent } from '@/lib/respondent';

type Params = { params: Promise<{ formId: string }> };

/**
 * 응답 화면(비로그인 방문자 포함)에서 입력 중 호출하는 값 제안 — 값 사전(빈도 기반)과
 * 군집 기반(같은 부서 동료들의 답) 두 갈래를 함께 돌려준다. 둘 다 서비스 계층에서
 * 익명/개인식별/마스킹 대상 문항은 이미 걸러지고, 군집 기반은 신원이 확인된 응답자의
 * 부서 정보가 있을 때만(그리고 코호트가 충분히 클 때만) 채워진다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get('fieldId');
  const q = searchParams.get('q') ?? '';
  if (!fieldId) return NextResponse.json({ suggestions: [], clusterSuggestions: [] });

  const identity = await resolveRespondent(formId);
  const [suggestions, clusterSuggestions] = await Promise.all([
    suggestValues(formId, fieldId, q),
    suggestClusterValues(formId, fieldId, identity.user?.department, identity.user?.id),
  ]);
  return NextResponse.json({ suggestions, clusterSuggestions });
}
