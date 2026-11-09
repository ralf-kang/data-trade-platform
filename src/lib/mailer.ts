import nodemailer from 'nodemailer';

/**
 * SMTP 메일 발송 (최고관리자 로그인 인증번호 등).
 *
 * 환경변수: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 * docker-compose.yml의 app 서비스는 environment를 명시 나열하므로, 새 변수를 추가하면
 * 그쪽에도 함께 등록해야 컨테이너에 전달된다.
 */

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendLoginCodeEmail(to: string, code: string, ttlMinutes: number): Promise<void> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      // 개발 환경 편의: SMTP 없이도 흐름을 시험할 수 있도록 콘솔에만 출력한다.
      console.log(`[mailer:dev] ${to} 로그인 인증번호: ${code}`);
      return;
    }
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  await createTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: '[Web Report Editor] 최고관리자 로그인 인증번호',
    text: `인증번호: ${code}\n\n${ttlMinutes}분 안에 입력해 주세요.\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `
      <div style="font-family:'Malgun Gothic',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
        <h2 style="margin:0 0 8px">최고관리자 로그인 인증번호</h2>
        <p style="margin:0 0 20px;color:#475569">Web Report Editor 로그인 화면에 아래 6자리 번호를 입력하세요.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center">${code}</div>
        <p style="margin:20px 0 0;color:#64748b;font-size:13px">${ttlMinutes}분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      </div>`,
  });
  console.log(`[mailer] 로그인 인증번호 메일 발송 완료 → ${to}`);
}
