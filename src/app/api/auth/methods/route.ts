import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { maskEmail, superAdminEmail } from '@/lib/superAdminOtp';

/**
 * 로그인 화면이 어떤 로그인 방식을 보여줄지 결정하는 공개(무인증) 조회.
 * LDAP 접속정보 등 민감 설정은 절대 내보내지 않고 사용 여부만 알린다.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const ldap = await prisma.ldapConfig.findUnique({
    where: { id: 'default' },
    select: { enabled: true, host: true, baseDn: true },
  });
  return NextResponse.json({
    ldapEnabled: !!(ldap?.enabled && ldap.host && ldap.baseDn),
    superAdminEmailMasked: maskEmail(superAdminEmail()),
  });
}
