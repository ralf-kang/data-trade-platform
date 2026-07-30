import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { createFormLink, listFormLinks } from '@/lib/services/formLinkService';

export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const links = await listFormLinks();
  return NextResponse.json({ links });
}

// 인스펙터 패널의 "관계로 저장"(§2-3).
export async function POST(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const actor = await getCurrentUser();
  try {
    const link = await createFormLink(
      {
        leftFormId: body.leftFormId,
        leftFieldId: body.leftFieldId,
        rightFormId: body.rightFormId,
        rightFieldId: body.rightFieldId,
        name: body.name,
        reverseName: body.reverseName,
        cardinality: body.cardinality,
        normalization: body.normalization ?? {},
        description: body.description,
      },
      actor
    );
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === 'ANONYMOUS_FIELD') {
      return NextResponse.json({ error: 'ANONYMOUS_FIELD', message: '익명 문항은 관계로 연결할 수 없습니다.' }, { status: 400 });
    }
    throw err;
  }
}
