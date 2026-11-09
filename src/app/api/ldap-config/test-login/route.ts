import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { testUserLogin } from '@/lib/services/ldapService';

/**
 * 설정 화면의 "테스트 로그인" — 실제 Windows 계정 하나로 검색·비밀번호·속성 매핑을 확인한다.
 * 계정 생성/세션 발급은 하지 않는다. 슈퍼관리자 전용.
 */
export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return NextResponse.json(await testUserLogin(username, password));
}
