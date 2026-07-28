import { NextRequest, NextResponse } from 'next/server';
import { listFormSubmissions, submitFormResponse } from '@/lib/services/submissionService';

type Params = { params: Promise<{ formId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
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
