import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isApiAuthError } from '@/lib/apiAuth';
import { mapIngestError } from '@/lib/apiErrors';
import { prisma } from '@/lib/db';
import { listSubmissionsByCursor } from '@/lib/elasticsearch';
import { ingestSubmissions } from '@/lib/services/apiIngestService';

type Params = { params: Promise<{ formId: string }> };

/**
 * GET /api/v1/forms/{formId}/submissions
 *
 * 대량 조회 — search_after 커서 페이지네이션.
 *   ?pageSize=100        (최대 1000)
 *   ?since=2026-07-01T00:00:00Z   해당 시각 이후 제출만 (증분 동기화)
 *   ?cursor=<nextCursor>          이전 응답의 nextCursor로 이어서 조회
 *
 * 전체를 순회하려면 nextCursor가 null이 될 때까지 반복 호출한다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const authResult = await authenticateApiRequest(request, formId, 'read');
  if (isApiAuthError(authResult)) return authResult.error;

  const sp = request.nextUrl.searchParams;
  const pageSize = Number(sp.get('pageSize') ?? '100') || 100;
  const since = sp.get('since') ?? undefined;
  const cursor = sp.get('cursor') ?? undefined;

  const registry = await prisma.formRegistry.findUnique({ where: { id: formId } });
  if (!registry) return NextResponse.json({ error: 'FORM_NOT_FOUND' }, { status: 404 });

  try {
    const result = await listSubmissionsByCursor({ formId, since, cursor, pageSize });
    return NextResponse.json(
      {
        formId,
        schemaVersion: registry.schemaVersion,
        total: result.total,
        count: result.items.length,
        nextCursor: result.nextCursor,
        items: result.items,
      },
      { headers: { 'X-Form-Schema-Version': String(registry.schemaVersion) } }
    );
  } catch {
    return NextResponse.json(
      { error: 'INVALID_CURSOR', message: 'cursor 값이 올바르지 않습니다.' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/v1/forms/{formId}/submissions
 *
 * 단건 입력. 대량은 /submissions/bulk 를 사용한다.
 * body: { externalId?, submittedAt?, data: {...} }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const authResult = await authenticateApiRequest(request, formId, 'write');
  if (isApiAuthError(authResult)) return authResult.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const row = body as { externalId?: string; submittedAt?: string; data?: Record<string, unknown> };
  if (!row?.data || typeof row.data !== 'object') {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'data 객체가 필요합니다. 예: { "data": { "f101-1": "홍길동" } }' },
      { status: 400 }
    );
  }

  try {
    const result = await ingestSubmissions(
      formId,
      [{ externalId: row.externalId, submittedAt: row.submittedAt, data: row.data }],
      { mode: 'strict', apiKeyPrefix: authResult.auth.key.keyPrefix }
    );
    const rowResult = result.results[0];
    const status = rowResult.status === 'accepted' ? 201 : rowResult.status === 'duplicate' ? 200 : 422;
    return NextResponse.json({ schemaVersion: result.schemaVersion, ...rowResult }, { status });
  } catch (err) {
    return mapIngestError(err);
  }
}
