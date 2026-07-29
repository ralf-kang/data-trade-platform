import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/services/auditService';

type Params = { params: Promise<{ formId: string }> };

/**
 * 마스킹 예외 해제 — 슈퍼관리자 전용, 사유 기록 필수.
 *
 * 무자격으로 만들어진 양식(authorHadPrivacyAuth=false)의 데이터는 기본적으로
 * 마스킹된다. 제작자가 나중에 자격을 얻어도 자동으로 풀리지 않는다 — 사후 승인으로
 * 소급 정당화되면 "일단 걷고 나중에 자격 따면 된다"가 학습되기 때문이다.
 * 예외가 필요하면(예: 실제로는 개인정보가 아니었다고 판단되는 경우) 슈퍼관리자가
 * 검토하고 사유를 남긴 뒤에만 해제한다.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireSuperAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const body = await request.json();
  if (!body?.reason || typeof body.reason !== 'string' || body.reason.trim().length < 5) {
    return NextResponse.json(
      { error: 'REASON_REQUIRED', message: '예외 해제 사유를 5자 이상 입력해주세요.' },
      { status: 400 }
    );
  }

  const actor = await getCurrentUser();
  const registry = await prisma.formRegistry.update({
    where: { id: formId },
    data: {
      maskingExemptedBy: actor.email,
      maskingExemptedAt: new Date(),
      maskingExemptReason: body.reason,
    },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'MASKING_EXEMPTION_GRANT',
    target: `Form [${formId}]`,
    details: `마스킹 예외 해제 — 사유: ${body.reason}`,
    severity: 'critical',
    formId,
  });

  return NextResponse.json({ form: registry });
}

/** 예외 취소 — 다시 마스킹을 적용한다. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireSuperAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  const registry = await prisma.formRegistry.update({
    where: { id: formId },
    data: { maskingExemptedBy: null, maskingExemptedAt: null, maskingExemptReason: null },
  });

  await logAudit({
    userEmail: actor.email,
    action: 'MASKING_EXEMPTION_REVOKE',
    target: `Form [${formId}]`,
    details: '마스킹 예외 취소 — 마스킹 재적용',
    severity: 'warning',
    formId,
  });

  return NextResponse.json({ form: registry });
}
