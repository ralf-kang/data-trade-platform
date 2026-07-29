import { NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { buildFormWordCloud } from '@/lib/services/wordCloudService';

type Params = { params: Promise<{ formId: string }> };

// 제출 데이터 조회와 같은 권한 기준(소유자 또는 공유승인) — 워드클라우드도 결국
// 제출 데이터에서 파생된 통계이므로 동일한 접근 통제를 적용한다.
export async function GET(_request: Request, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 제출 데이터를 조회할 권한이 없습니다. 소유자에게 공유를 요청하세요.' },
      { status: 403 }
    );
  }

  const result = await buildFormWordCloud(formId);
  return NextResponse.json(result);
}
