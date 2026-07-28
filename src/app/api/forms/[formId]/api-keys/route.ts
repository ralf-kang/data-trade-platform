import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { isOwnerOrSuperAdmin } from '@/lib/services/formService';
import { createApiKey, listApiKeys } from '@/lib/services/apiKeyService';

type Params = { params: Promise<{ formId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 API 키를 관리할 수 있습니다.' },
      { status: 403 }
    );
  }

  const keys = await listApiKeys(formId);
  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { formId } = await params;
  const actor = await getCurrentAdmin();
  if (!(await isOwnerOrSuperAdmin(formId, actor))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '이 양식지의 소유자만 API 키를 발급할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const scope = ['READ', 'WRITE', 'READ_WRITE'].includes(body.scope) ? body.scope : 'READ';

  const { record, plaintextKey } = await createApiKey(
    {
      formId,
      name: body.name,
      scope,
      rateLimitPerMin: body.rateLimitPerMin ? Number(body.rateLimitPerMin) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    actor
  );

  // plaintextKey는 이 응답에서만 볼 수 있다 (DB에는 해시만 저장).
  return NextResponse.json({ key: record, plaintextKey }, { status: 201 });
}
