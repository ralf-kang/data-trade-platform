import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildWordCloud } from '@/lib/services/wordCloudService';

// 범위 지정형 워드클라우드 — 요청에 담긴 formIds를 그대로 신뢰하지 않고, 실제로
// 본인 소유인 양식지만 걸러낸다 (canAccessFormData와 같은 원칙: 남의 양식지는 조회 불가).
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const actor = await getCurrentUser();
  const body = await request.json();
  const requestedFormIds: string[] = Array.isArray(body.formIds) ? body.formIds : [];
  if (requestedFormIds.length === 0) {
    return NextResponse.json({ error: 'formIds is required' }, { status: 400 });
  }

  const owned = await prisma.formRegistry.findMany({
    where: { id: { in: requestedFormIds }, ownerId: actor.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((f) => f.id));
  const formIds = requestedFormIds.filter((id) => ownedIds.has(id));
  if (formIds.length === 0) {
    return NextResponse.json({ error: 'FORBIDDEN', message: '본인이 제작한 양식지만 분석할 수 있습니다.' }, { status: 403 });
  }

  const fieldIdsByForm =
    body.fieldIdsByForm && typeof body.fieldIdsByForm === 'object' ? body.fieldIdsByForm : undefined;

  const result = await buildWordCloud({ formIds, fieldIdsByForm });
  return NextResponse.json(result);
}
