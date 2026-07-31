import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { canAccessFormData } from '@/lib/services/formService';
import { listMapEligibleFields, analyzeAddressDistribution } from '@/lib/services/addressMapService';
import { logAudit } from '@/lib/services/auditService';

type Params = { params: Promise<{ formId: string }> };

// 주소 분포 조회 — 제출 데이터 조회와 같은 권한 기준.
export async function GET(request: NextRequest, { params }: Params) {
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

  const { searchParams } = new URL(request.url);
  const fieldId = searchParams.get('fieldId');
  const level = searchParams.get('level') === 'sigungu' ? 'sigungu' : 'sido';

  const fields = await listMapEligibleFields(formId);
  if (!fieldId) return NextResponse.json({ fields, result: null });

  const result = await analyzeAddressDistribution(formId, fieldId, level);

  // 지도 조회도 데이터 출구다 — 워드클라우드 조회와 같이 기록한다(§1-3).
  if (result) {
    await logAudit({
      userEmail: actor.email,
      action: 'ADDRESS_MAP_VIEW',
      target: `Form [${formId}] field [${fieldId}]`,
      details: `주소 분포 조회 (${level}, 표시 ${result.regions.length}개 지역 / 가림 ${result.suppressedRegions}개)`,
      severity: 'info',
      formId,
    });
  }

  return NextResponse.json({ fields, result });
}
