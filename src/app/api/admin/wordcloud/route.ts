import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildWordCloud } from '@/lib/services/wordCloudService';
import { logAudit } from '@/lib/services/auditService';

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

  const result = await buildWordCloud({ formIds, fieldIdsByForm, piiBypassAck: !!body.piiBypassAck });

  // 우회가 실제로 적용된 폼이 있으면 매번 감사 로그를 남긴다 — k-익명성 게이트를 낮춘
  // 조회는 "권한이 있다"만으로는 부족하고, 언제 누가 실제로 무엇을 봤는지 남아야 한다.
  if (result.piiBypassForms.length > 0) {
    await logAudit({
      userEmail: actor.email,
      action: 'WORDCLOUD_PII_BYPASS',
      target: `Forms [${result.piiBypassForms.join(', ')}]`,
      details: `개인정보취급자 k=5 우회 모드로 워드클라우드 조회 (${result.piiBypassForms.length}건)`,
      severity: 'warning',
    });
  }

  return NextResponse.json(result);
}
