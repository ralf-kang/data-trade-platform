import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin, requireSuperAdmin } from '@/lib/auth';
import { getSystemConfig, setPublicBaseUrl, setRewardVisibility } from '@/lib/services/systemConfigService';
import { logAudit } from '@/lib/services/auditService';

const REWARD_VISIBILITY_VALUES = ['HIDDEN', 'ADMIN_ONLY', 'ALL_MEMBERS'];

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

  if (body.rewardVisibility !== undefined) {
    if (!REWARD_VISIBILITY_VALUES.includes(body.rewardVisibility)) {
      return NextResponse.json(
        { error: 'rewardVisibility must be HIDDEN | ADMIN_ONLY | ALL_MEMBERS' },
        { status: 400 }
      );
    }
    const config = await setRewardVisibility(body.rewardVisibility);
    const actor = await getCurrentUser();
    await logAudit({
      userEmail: actor.email,
      action: 'REWARD_VISIBILITY_CHANGE',
      target: 'SystemConfig [default]',
      details: `보상 화면 가시성을 ${body.rewardVisibility}(으)로 변경`,
      severity: 'info',
    });
    return NextResponse.json({ config });
  }

  const config = await setPublicBaseUrl(body.publicBaseUrl || null);
  return NextResponse.json({ config });
}
