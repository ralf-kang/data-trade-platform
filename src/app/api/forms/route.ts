import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { createForm, listForms, listFormsWithAccess } from '@/lib/services/formService';

// ?mine=1 이면 로그인한 관리자가 소유한 양식지만 반환한다 ("내 양식 관리" 화면 전용).
// ?withAccess=1 이면 각 양식지에 대한 제출 데이터 접근 권한(owner/shared/none)을 함께
// 반환한다 ("제출 데이터 통합 조회" 화면 전용).
// 파라미터 없이 호출하면 전체 목록을 반환한다 — 대시보드 랭킹, "다른 관리자 양식
// 둘러보기/복사 신청" 같은 교차 열람 기능에 필요하기 때문이며, 실제 제출 데이터 접근은
// 이 목록과 별개로 canAccessFormData()로 항상 재검증된다.
export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const sp = request.nextUrl.searchParams;
  if (sp.get('withAccess') === '1') {
    const actor = await getCurrentAdmin();
    const forms = await listFormsWithAccess(actor);
    return NextResponse.json({ forms });
  }

  const mine = sp.get('mine') === '1';
  const actor = mine ? await getCurrentAdmin() : null;
  const forms = await listForms(actor ? { ownerId: actor.id } : {});
  return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  if (!body?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  const form = await createForm(
    {
      id: body.id,
      title: body.title,
      description: body.description ?? '',
      fields: body.fields ?? [],
    },
    actor
  );
  return NextResponse.json({ form }, { status: 201 });
}
