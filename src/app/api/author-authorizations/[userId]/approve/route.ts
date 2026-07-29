import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { approveAuthorAuthorization } from '@/lib/services/authorAuthService';

type Params = { params: Promise<{ userId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireSuperAdmin();
  if (unauthorized) return unauthorized;

  const { userId } = await params;
  const actor = await getCurrentUser();
  const auth = await approveAuthorAuthorization(userId, actor);
  return NextResponse.json({ authorization: auth });
}
