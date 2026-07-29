import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isPlatformAdmin, requireAdmin } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { canAccessFormData, getForm } from '@/lib/services/formService';
import { exportFormSubmissions } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string }> };

// 대량 추출(CSV) 전용 엔드포인트. /submissions GET(목록 조회)과 분리해 둔 이유는
// "반복적/체계적 대량 추출"에는 더 엄격한 속도 제한과 별도의 감사 로그(DATA_EXPORT)를
// 적용하기 위함이다 (저작권법 제93조 대응 기술적 조치).
export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();

  if (!(await canAccessFormData(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 제출 데이터를 조회할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  // 슈퍼관리자가 개인정보 오남용을 우려해 개별 관리자의 대량 추출을 제한할 수 있다.
  if (!actor.canBulkExport && !isPlatformAdmin(actor)) {
    return NextResponse.json(
      { error: 'EXPORT_RESTRICTED', message: '대량 추출 권한이 슈퍼관리자에 의해 제한되어 있습니다.' },
      { status: 403 }
    );
  }

  // 목록 조회보다 훨씬 낮은 한도: 5분에 5회.
  const rate = checkRateLimit(`submissions:export:${actor.email}`, 5, 5 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: '대량 추출 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  const form = await getForm(formId);
  if (!form) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const search = request.nextUrl.searchParams.get('search') ?? undefined;
  const { items } = await exportFormSubmissions(formId, actor, { search });

  const columns = form.fields.map((f) => ({ key: f.id, label: f.label }));
  const rows = [
    ['ID', '제출 일시', ...columns.map((c) => c.label)],
    ...items.map((row) => [
      row.submissionId,
      row.submittedAt,
      ...columns.map((c) => String(row.data[c.key] ?? '')),
    ]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${formId}_data.csv"`,
    },
  });
}
