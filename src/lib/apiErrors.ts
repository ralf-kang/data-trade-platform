import { NextResponse } from 'next/server';

/**
 * 대량 입력 서비스가 던지는 도메인 오류를 HTTP 응답으로 옮긴다.
 *
 * route.ts 파일은 HTTP 메서드 핸들러만 export해야 하므로(Next.js가 export 시그니처를
 * 검증한다) 공용 헬퍼는 이 모듈에 둔다.
 */
export function mapIngestError(err: unknown) {
  const message = err instanceof Error ? err.message : 'unknown';
  if (message === 'FORM_NOT_FOUND' || message === 'FORM_TEMPLATE_NOT_FOUND') {
    return NextResponse.json({ error: 'FORM_NOT_FOUND' }, { status: 404 });
  }
  if (message === 'FORM_NOT_PUBLISHED') {
    return NextResponse.json(
      {
        error: 'FORM_NOT_PUBLISHED',
        message:
          '양식지가 아직 확정(PUBLISHED)되지 않았습니다. 설계가 진행 중인 양식지에는 외부 입력을 받을 수 없습니다.',
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: 'INGEST_FAILED', message }, { status: 500 });
}
