import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { listForms } from '@/lib/services/formService';

// 관계 캔버스 툴박스(§2-2)가 쓰는 전체 양식지 목록 — 슈퍼관리자는 소유 여부와 무관하게
// 모든 양식지를 대상으로 관계를 만들 수 있다(§5-2). 익명 문항은 S1에 따라 제외한다.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const forms = await listForms();
  return NextResponse.json({
    forms: forms.map((f) => ({
      formId: f.id,
      title: f.title,
      fields: f.fields
        .filter((field) => !field.anonymous)
        .map((field) => ({ id: field.id, label: field.label, type: field.type, personalIdentifier: !!field.personalIdentifier })),
    })),
  });
}
