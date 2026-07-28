import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { verifyApiKey, type VerifiedApiKey } from '@/lib/services/apiKeyService';

/**
 * 공개 v1 API(`/api/v1/**`) 전용 인증.
 *
 * 관리자 화면용 API가 쿠키 기반인 것과 달리, 외부 시스템 연동은 `Authorization: Bearer <키>`
 * 헤더로 인증한다. 키는 특정 양식지(formId)에 묶여 있어, 다른 양식지 데이터에는 접근할 수 없다.
 */

export interface ApiAuthSuccess {
  auth: VerifiedApiKey;
}

export type ApiAuthResult = ApiAuthSuccess | { error: NextResponse };

export function isApiAuthError(r: ApiAuthResult): r is { error: NextResponse } {
  return 'error' in r;
}

function jsonError(code: string, message: string, status: number, extraHeaders?: HeadersInit) {
  return NextResponse.json({ error: code, message }, { status, headers: extraHeaders });
}

export async function authenticateApiRequest(
  request: NextRequest,
  formId: string,
  need: 'read' | 'write'
): Promise<ApiAuthResult> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return {
      error: jsonError(
        'UNAUTHORIZED',
        'Authorization: Bearer <API_KEY> 헤더가 필요합니다.',
        401,
        { 'WWW-Authenticate': 'Bearer' }
      ),
    };
  }

  const auth = await verifyApiKey(match[1]);
  if (!auth) {
    return { error: jsonError('INVALID_API_KEY', '유효하지 않거나 폐기/만료된 API 키입니다.', 401) };
  }

  // 키는 발급된 양식지에만 쓸 수 있다.
  if (auth.key.formId !== formId) {
    return {
      error: jsonError(
        'FORBIDDEN',
        `이 API 키는 양식지 [${auth.key.formId}] 전용입니다. [${formId}]에는 사용할 수 없습니다.`,
        403
      ),
    };
  }

  if (need === 'read' && !auth.canRead) {
    return { error: jsonError('INSUFFICIENT_SCOPE', '이 키에는 READ 권한이 없습니다.', 403) };
  }
  if (need === 'write' && !auth.canWrite) {
    return { error: jsonError('INSUFFICIENT_SCOPE', '이 키에는 WRITE 권한이 없습니다.', 403) };
  }

  // 키 단위 분당 요청 상한 (대량 추출/투입 남용 방지).
  const rate = checkRateLimit(`apiv1:${auth.key.id}`, auth.key.rateLimitPerMin, 60_000);
  if (!rate.allowed) {
    return {
      error: jsonError('RATE_LIMITED', '분당 요청 한도를 초과했습니다.', 429, {
        'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
      }),
    };
  }

  return { auth };
}
