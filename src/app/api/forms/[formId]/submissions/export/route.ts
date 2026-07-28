import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { getForm } from '@/lib/services/formService';
import { exportFormSubmissions } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string }> };

// 대량 추출(CSV) 전용 엔드포인트. /submissions GET(목록 조회)과 분리해 둔 이유는
// "반복적/체계적 대량 추출"에는 더 엄격한 속도 제한과 별도의 감사 로그(DATA_EXPORT)를
// 적용하기 위함이다 (저작권법 제93조 대응 기술적 조치).
export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  // 목록 조회보다 훨씬 낮은 한도: 5분에 5회.
  const rate = checkRateLimit(`submissions:export:${actor.email}`, 5, 5 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: '대량 추출 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  const { formId } = await params;
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
