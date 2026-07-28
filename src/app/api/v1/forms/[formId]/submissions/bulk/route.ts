import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isApiAuthError } from '@/lib/apiAuth';
import { mapIngestError } from '@/lib/apiErrors';
import { ingestSubmissions, type IngestMode } from '@/lib/services/apiIngestService';

type Params = { params: Promise<{ formId: string }> };

// 한 번에 받을 수 있는 최대 행 수 — 요청 본문이 지나치게 커지는 것을 막는다.
const MAX_ROWS = 1000;

/**
 * POST /api/v1/forms/{formId}/submissions/bulk
 *
 * 대량 입력. body:
 *   {
 *     "mode": "lenient" | "strict",     // 기본 lenient
 *     "rows": [ { "externalId": "ERP-001", "data": { "f101-1": "홍길동" } }, ... ]
 *   }
 *
 * 응답은 행별 결과(accepted/rejected/duplicate)를 그대로 돌려주므로, 연동 측은
 * 거부된 행만 골라 수정 후 재전송할 수 있다. externalId를 넣으면 같은 배치를 다시
 * 보내도 중복 적재되지 않는다(멱등).
 *
 * HTTP 상태:
 *   200 전부 수용/중복, 207 부분 수용(일부 거부), 422 전량 거부
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

  const parsed = body as { mode?: string; rows?: unknown };
  if (!Array.isArray(parsed?.rows)) {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'rows 배열이 필요합니다.' },
      { status: 400 }
    );
  }
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: 'EMPTY_ROWS', message: 'rows가 비어 있습니다.' }, { status: 400 });
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: 'TOO_MANY_ROWS',
        message: `한 번에 최대 ${MAX_ROWS}건까지 전송할 수 있습니다 (요청: ${parsed.rows.length}건). 나눠서 호출하세요.`,
      },
      { status: 413 }
    );
  }

  const mode: IngestMode = parsed.mode === 'strict' ? 'strict' : 'lenient';

  try {
    const result = await ingestSubmissions(
      formId,
      parsed.rows as Parameters<typeof ingestSubmissions>[1],
      { mode, apiKeyPrefix: authResult.auth.key.keyPrefix }
    );
    const status = result.accepted === 0 && result.rejected > 0 ? 422 : result.rejected > 0 ? 207 : 200;
    return NextResponse.json(result, {
      status,
      headers: { 'X-Form-Schema-Version': String(result.schemaVersion) },
    });
  } catch (err) {
    return mapIngestError(err);
  }
}
