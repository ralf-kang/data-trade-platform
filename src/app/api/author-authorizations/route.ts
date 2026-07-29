import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { listAuthorAuthorizations } from '@/lib/services/authorAuthService';

/** 개인정보취급자 명부 — 슈퍼관리자 전용. */
export async function GET() {
  const unauthorized = await requireSuperAdmin();
  if (unauthorized) return unauthorized;

  const list = await listAuthorAuthorizations();
  return NextResponse.json({ authorizations: list });
}
