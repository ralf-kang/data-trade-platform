import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { listFormSubmissions, submitFormResponse } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string }> };

// 제출 데이터(비정형, Elasticsearch) 조회 — 데이터베이스제작자의 상당한 투자가 들어간
// 실제 데이터베이스 본체이므로 관리자 인증과 요청 빈도 제한을 모두 적용한다.
export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentAdmin();
  const rate = checkRateLimit(`submissions:list:${actor.email}`, 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  const { formId } = await params;
  const sp = request.nextUrl.searchParams;
  const page = Number(sp.get('page') ?? '1') || 1;
  const pageSize = Number(sp.get('pageSize') ?? '20') || 20;
  const search = sp.get('search') ?? undefined;

  const result = await listFormSubmissions(formId, { page, pageSize, search });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const body = await request.json();
  if (!body?.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data object is required' }, { status: 400 });
  }
  const result = await submitFormResponse(formId, body.data);
  return NextResponse.json(result, { status: 201 });
}
