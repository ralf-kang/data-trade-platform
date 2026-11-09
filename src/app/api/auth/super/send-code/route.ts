import { NextRequest, NextResponse } from 'next/server';
import { issueCode, maskEmail, OTP_TTL_MIN, revokeCode, superAdminEmail } from '@/lib/superAdminOtp';
import { sendLoginCodeEmail } from '@/lib/mailer';
import { clientIp, limitOrNull } from '@/lib/loginGuard';

/**
 * 최고관리자 인증번호 발송.
 * 수신 주소는 요청 본문에서 받지 않는다 — 서버 설정(SUPER_ADMIN_EMAIL)으로 고정.
 */
export async function POST(request: NextRequest) {
  const limited = limitOrNull(`super-otp-send:${clientIp(request)}`, 5, 10 * 60_000);
  if (limited) return limited;

  const email = superAdminEmail();
  const issued = issueCode(email);
  if (!issued.ok) {
    return NextResponse.json(
      { error: 'COOLDOWN', message: `인증번호를 이미 보냈습니다. ${issued.retryAfterSec}초 후 다시 요청할 수 있습니다.`, retryAfterSec: issued.retryAfterSec },
      { status: 429 }
    );
  }

  try {
    await sendLoginCodeEmail(email, issued.code, OTP_TTL_MIN);
  } catch (err) {
    revokeCode(email);
    console.error('[super/send-code] 메일 발송 실패:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'MAIL_FAILED', message: '인증번호 메일을 보내지 못했습니다. 서버의 SMTP 설정을 확인하세요.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: maskEmail(email), ttlMinutes: OTP_TTL_MIN });
}
