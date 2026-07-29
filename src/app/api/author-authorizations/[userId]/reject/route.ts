import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { rejectAuthorAuthorization } from '@/lib/services/authorAuthService';

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireSuperAdmin();
  if (unauthorized) return unauthorized;

  const { userId } = await params;
  const body = await request.json();
  if (!body?.reason) {
    return NextResponse.json({ error: 'REASON_REQUIRED', message: '거부 사유를 입력해주세요.' }, { status: 400 });
  }
  const actor = await getCurrentUser();
  const auth = await rejectAuthorAuthorization(userId, body.reason, actor);
  return NextResponse.json({ authorization: auth });
}
