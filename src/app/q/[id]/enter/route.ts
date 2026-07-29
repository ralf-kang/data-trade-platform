import { NextRequest, NextResponse } from 'next/server';
import { respondentCookieName, verifyToken } from '@/lib/respondent';

type Params = { params: Promise<{ id: string }> };

/**
 * 개인화 링크 진입점 — 토큰을 응답 세션 쿠키로 교환하고 즉시 응답 화면으로 보낸다.
 *
 * 이 경로가 따로 있는 이유는 두 가지다:
 *  1. Next.js는 서버 컴포넌트 렌더링 중 쿠키 변경을 허용하지 않는다. Set-Cookie는
 *     Route Handler의 응답에만 실을 수 있다.
 *  2. 토큰이 URL에 남아 있으면 브라우저 히스토리·Referer 헤더·웹서버 액세스 로그에
 *     기록되어, 그 로그를 볼 수 있는 사람이 타인의 응답 링크를 그대로 쓸 수 있다.
 *     교환 직후 쿼리스트링 없는 URL로 리다이렉트해 이 경로를 끊는다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: formId } = await params;
  const rawToken = request.nextUrl.searchParams.get('t') ?? '';

  const target = new URL(`/q/${formId}`, request.nextUrl.origin);
  const response = NextResponse.redirect(target);
  // 토큰이 새 나가지 않도록 Referer 전달을 막는다.
  response.headers.set('Referrer-Policy', 'no-referrer');

  const verified = await verifyToken(formId, rawToken);
  if (verified) {
    response.cookies.set(respondentCookieName(formId), verified.tokenHash, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // 쿠키 수명은 토큰 만료와 맞춘다.
      expires: verified.expiresAt,
      path: '/',
    });
  }
  // 토큰이 유효하지 않아도 리다이렉트는 한다 — 실패한 토큰이라도 URL·로그에 남길 이유가
  // 없다. 신원이 필요한 양식이면 응답 화면에서 안내가 나간다.
  return response;
}
