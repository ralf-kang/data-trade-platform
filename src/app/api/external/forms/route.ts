import { NextRequest, NextResponse } from 'next/server';
import { getForm, listForms } from '@/lib/services/formService';

/**
 * 외부 연동 서비스(웹2 서버실 출입통제 웹서비스 등)용 공개 API 엔드포인트.
 * 웹1에서 관리/생성된 양식지 템플릿 목록과 세부 구조(fields, fillableBy 등)를 반환한다.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const formId = searchParams.get('id');

  if (formId) {
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    return NextResponse.json({ form }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const forms = await listForms({});
  // OPEN 및 PUBLISHED 상태의 양식지만 외부 공개
  const openForms = forms.filter((f) => f.status === 'OPEN' && f.active);

  return NextResponse.json({ forms: openForms }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
