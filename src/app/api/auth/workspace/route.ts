import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, isPlatformAdmin, requireAdmin } from '@/lib/auth';

/**
 * 워크스페이스 전환 (일반 관리자 ↔ 슈퍼관리자).
 *
 * adminRole 쿠키는 "어떤 사이드바를 보여줄지"를 정하는 화면용 값이다. 실제 권한 판정은
 * requireSuperAdmin()이 DB의 UserRole을 보고 하므로 쿠키를 바꾼다고 권한이 생기지는
 * 않지만, 권한도 없는 사람에게 슈퍼관리자 메뉴를 띄워 404·403만 계속 보게 만드는 것은
 * 그 자체로 잘못된 안내다. 그래서 전환 시점에도 DB 역할을 확인한다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const workspace = body.workspace;
  if (workspace !== 'admin' && workspace !== 'super-admin') {
    return NextResponse.json({ error: 'workspace must be admin | super-admin' }, { status: 400 });
  }

  const actor = await getCurrentUser();
  if (workspace === 'super-admin' && !isPlatformAdmin(actor)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '슈퍼관리자 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const store = await cookies();
  store.set('adminRole', workspace, { path: '/' });
  return NextResponse.json({ ok: true, workspace });
}
