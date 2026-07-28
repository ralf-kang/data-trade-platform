import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isApiAuthError } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { getFormTemplate } from '@/lib/elasticsearch';

type Params = { params: Promise<{ formId: string }> };

/**
 * GET /api/v1/forms/{formId}/schema
 *
 * 연동 계약(contract) 조회 — 외부 시스템이 어떤 키로 어떤 값을 보내야 하는지 알려준다.
 * 대량 입력을 구현하기 전에 이 응답을 먼저 확인하는 것이 정상 흐름이다.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { formId } = await params;
  const authResult = await authenticateApiRequest(request, formId, 'read');
  if (isApiAuthError(authResult)) return authResult.error;

  const [registry, template] = await Promise.all([
    prisma.formRegistry.findUnique({ where: { id: formId } }),
    getFormTemplate(formId),
  ]);
  if (!registry || !template) {
    return NextResponse.json({ error: 'FORM_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(
    {
      formId,
      title: template.title,
      description: template.description,
      lifecycle: registry.lifecycle,
      schemaVersion: registry.schemaVersion,
      // DRAFT면 아직 계약이 확정되지 않았음을 명확히 알린다.
      writable: registry.lifecycle === 'PUBLISHED',
      fields: template.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: !!f.required,
        ...(f.options ? { options: f.options } : {}),
        ...(f.regexPattern ? { pattern: f.regexPattern } : {}),
        ...(f.description ? { description: f.description } : {}),
      })),
    },
    { headers: { 'X-Form-Schema-Version': String(registry.schemaVersion) } }
  );
}
