import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireSuperAdmin } from '@/lib/auth';
import { getSystemConfig, setPublicBaseUrl } from '@/lib/services/systemConfigService';

// 일반 관리자도 QR/URL 생성에 필요한 base URL을 읽을 수 있어야 하므로 GET은 로그인만 요구.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const config = await getSystemConfig();
  return NextResponse.json({ config });
}

// 수정은 슈퍼관리자 시스템 환경 설정 화면 전용.
export async function PATCH(request: NextRequest) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const config = await setPublicBaseUrl(body.publicBaseUrl || null);
  return NextResponse.json({ config });
}
