import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { listForms } from '@/lib/services/formService';
import { listCategoryTree, getTaxonomyByForm } from '@/lib/services/formTaxonomyService';

// 관계 캔버스 툴박스(§2-2)가 쓰는 전체 양식지 목록 — 슈퍼관리자는 소유 여부와 무관하게
// 모든 양식지를 대상으로 관계를 만들 수 있다(§5-2). 익명 문항은 S1에 따라 제외한다.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const [forms, categoryTree, taxonomy] = await Promise.all([
    listForms(),
    listCategoryTree(),
    // 캔버스는 전사 도구이므로 개인 폴더는 쓰지 않는다 — 산업분야만 있으면 된다.
    getTaxonomyByForm(null),
  ]);
  return NextResponse.json({
    categoryTree,
    forms: forms.map((f) => ({
      formId: f.id,
      title: f.title,
      categoryIds: taxonomy.get(f.id)?.categoryIds ?? [],
      fields: f.fields
        .filter((field) => !field.anonymous)
        .map((field) => ({ id: field.id, label: field.label, type: field.type, personalIdentifier: !!field.personalIdentifier })),
    })),
  });
}
