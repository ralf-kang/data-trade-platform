import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listAdminUsers } from '@/lib/services/adminUserService';

// 목록 조회는 어떤 관리자든 가능하게 한다 — 양식지 소유권 이전/직접 공유 대상을
// 고르려면 다른 관리자들의 존재를 알아야 하기 때문이다. 실제 계정 속성 수정/삭제는
// /api/admin-users/[id] 에서 슈퍼관리자로만 제한된다.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const users = await listAdminUsers();
  return NextResponse.json({ users });
}
