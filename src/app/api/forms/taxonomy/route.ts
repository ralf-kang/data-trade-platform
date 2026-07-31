import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getCurrentUser, isPlatformAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  listCategoryTree,
  listFolderTree,
  getTaxonomyByForm,
  setFormCategories,
  setFormFolders,
} from '@/lib/services/formTaxonomyService';

/**
 * 목록 화면이 쓰는 통합 조회 + 배정 엔드포인트.
 * 산업분야 트리는 조회만이라면 일반 관리자에게도 열어 준다 — 배지와 필터에 필요하고,
 * 분류체계 자체는 감출 정보가 아니다(편집만 슈퍼관리자 전용).
 */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();

  const [categoryTree, folderTree, byForm] = await Promise.all([
    listCategoryTree(),
    listFolderTree(actor.id),
    getTaxonomyByForm(actor.id),
  ]);

  return NextResponse.json({
    categoryTree,
    folderTree,
    byForm: Object.fromEntries(byForm),
  });
}

/** 특정 양식지의 분류·폴더 배정. */
export async function PUT(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const actor = await getCurrentUser();
  const { formId, categoryIds, folderIds } = await request.json();
  if (!formId) return NextResponse.json({ error: 'formId가 필요합니다.' }, { status: 400 });

  const registry = await prisma.formRegistry.findUnique({ where: { id: formId }, select: { ownerId: true } });
  if (!registry) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const isOwner = registry.ownerId === actor.id;

  // 개인 폴더는 "내 작업공간"이므로 소유 여부와 무관하게 본인 폴더에 넣을 수 있다.
  if (Array.isArray(folderIds)) {
    await setFormFolders(actor.id, formId, folderIds);
  }

  // 산업분야는 전사 공통 값이라 아무나 바꾸면 안 된다 — 소유자 또는 슈퍼관리자만.
  if (Array.isArray(categoryIds)) {
    if (!isOwner && !isPlatformAdmin(actor)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: '산업분야 분류는 양식지 소유자 또는 슈퍼관리자만 변경할 수 있습니다.' },
        { status: 403 }
      );
    }
    await setFormCategories(formId, categoryIds, actor.email);
  }

  return NextResponse.json({ ok: true });
}
