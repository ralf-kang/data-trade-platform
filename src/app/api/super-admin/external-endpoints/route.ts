import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, getCurrentUser } from '@/lib/auth';
import { listEndpoints, updateEndpoint, testEndpoint } from '@/lib/services/externalEndpointService';
import { logAudit } from '@/lib/services/auditService';

// 외부로 나가는 목적지 목록은 방화벽 정책의 근거이자 감사 대상이므로 슈퍼관리자 전용.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;
  return NextResponse.json({ endpoints: await listEndpoints() });
}

export async function PATCH(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const { id, action, ...input } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

  const actor = await getCurrentUser();

  if (action === 'test') {
    const result = await testEndpoint(id);
    return NextResponse.json(result);
  }

  const updated = await updateEndpoint(id, input);
  await logAudit({
    userEmail: actor.email,
    action: 'EXTERNAL_ENDPOINT_UPDATE',
    target: `ExternalEndpointConfig [${id}]`,
    // 외부 통신 목적지 변경은 망 정책과 직결되므로 변경 후 값을 그대로 남긴다(키 제외).
    details: `모드=${updated.mode} 목적지=${updated.scheme ?? '-'}://${updated.host ?? '-'}:${updated.port ?? '-'}`,
    severity: 'warning',
  });
  return NextResponse.json({ endpoint: updated });
}
