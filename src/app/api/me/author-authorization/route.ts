import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { applyForAuthorAuthorization, getAuthorAuthorization } from '@/lib/services/authorAuthService';

/** 내 개인정보 취급자(제작 자격) 상태 조회. */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  const auth = await getAuthorAuthorization(user.id);
  return NextResponse.json({ authorization: auth });
}

/**
 * 제작 자격 신청.
 * 전 임직원이 신청 가능하되, 승인 전까지는 자격이 없다(기본 자격 없음) — 이 신청은
 * 심사를 요청하는 것이지 즉시 권한을 부여하지 않는다.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  const body = await request.json();
  if (!body?.purpose || !body?.plannedDataItems) {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: '수집 목적과 수집 예정 항목을 입력해주세요.' },
      { status: 400 }
    );
  }

  try {
    const auth = await applyForAuthorAuthorization(user, {
      purpose: body.purpose,
      plannedDataItems: body.plannedDataItems,
    });
    return NextResponse.json({ authorization: auth }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_APPLIED') {
      return NextResponse.json(
        { error: 'ALREADY_APPLIED', message: '이미 심사 중이거나 승인된 신청이 있습니다.' },
        { status: 409 }
      );
    }
    throw err;
  }
}
