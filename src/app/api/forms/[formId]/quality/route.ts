import { NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { analyzeFormQuality } from '@/lib/services/dataQualityService';

type Params = { params: Promise<{ formId: string }> };

// 결측치·이상치 조회 — 제출 데이터 조회와 같은 권한 기준(소유자 또는 공유승인).
export async function GET(_request: Request, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 제출 데이터를 조회할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const report = await analyzeFormQuality(formId);
  return NextResponse.json(report);
}
