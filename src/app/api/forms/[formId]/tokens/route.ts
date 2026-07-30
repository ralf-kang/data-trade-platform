import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { issueTokens } from '@/lib/respondent';
import { logAudit } from '@/lib/services/auditService';

type Params = { params: Promise<{ formId: string }> };

/** 발급 현황 — 원문 토큰은 어디에도 남아 있지 않으므로 접두와 상태만 돌려준다. */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 응답 링크를 관리할 수 있습니다.' },
      { status: 403 }
    );
  }

  const tokens = await prisma.respondentToken.findMany({
    where: { formId },
    orderBy: { issuedAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true, department: true } } },
  });
  return NextResponse.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      tokenPrefix: t.tokenPrefix,
      user: t.user,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      openedAt: t.openedAt,
      usedAt: t.usedAt,
      issuedAt: t.issuedAt,
    })),
  });
}

/**
 * 개인화 링크 일괄 발급.
 * 원문 링크는 이 응답에만 존재한다 — DB에는 해시만 저장되어 다시 조회할 수 없다.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentUser();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 응답 링크를 발급할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (!Array.isArray(body?.userIds) || body.userIds.length === 0) {
    return NextResponse.json({ error: 'userIds 배열이 필요합니다.' }, { status: 400 });
  }

  // 익명(ANONYMOUS) 양식지는 개인화 링크 자체가 익명성과 모순된다 — 링크를 받는 순간 그
  // 사람은 더 이상 익명이 아니다. 혼합(MIXED)은 "링크가 있으면 식별, 없으면 익명"이 정확히
  // 의도된 동작이므로 여기서는 막지 않는다 — 실제 신원 강제는 identityMode에 맡긴다.
  const registry = await prisma.formRegistry.findUnique({ where: { id: formId }, select: { identityMode: true } });
  if (registry?.identityMode === 'ANONYMOUS') {
    return NextResponse.json(
      { error: 'ANONYMOUS_FORM', message: '익명(ANONYMOUS) 양식지는 개인화 응답 링크를 발급할 수 없습니다.' },
      { status: 400 }
    );
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  const baseUrl = config?.publicBaseUrl || request.nextUrl.origin;
  const expiresAt = body.expiresAt
    ? new Date(body.expiresAt)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 기본 30일

  const result = await issueTokens(formId, body.userIds, {
    expiresAt,
    singleUse: !!body.singleUse,
    issuedBy: actor.email,
    baseUrl,
  });

  await logAudit({
    userEmail: actor.email,
    action: 'RESPONDENT_TOKEN_ISSUE',
    target: `Form [${formId}]`,
    details: `개인화 응답 링크 ${result.issued.length}건 발급 (건너뜀 ${result.skipped.length})`,
    severity: 'info',
    formId,
  });

  return NextResponse.json(result, { status: 201 });
}
