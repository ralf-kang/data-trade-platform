import { NextResponse } from 'next/server';
import { getDatabaseRights } from '@/lib/services/databaseRightsService';

// 저작권법상 데이터베이스제작자 고지는 통상적인 저작권 표시와 마찬가지로 "명시적으로
// 공개"되어야 실효성이 있으므로, 이 엔드포인트는 의도적으로 비로그인 상태에서도
// 열람 가능하게 둔다 (관리자 인증을 요구하지 않음).
export async function GET() {
  const info = await getDatabaseRights();
  if (!info) return NextResponse.json({ error: 'not registered' }, { status: 404 });
  return NextResponse.json(info);
}
