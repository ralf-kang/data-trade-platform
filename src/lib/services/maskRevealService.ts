import { getFormTemplate, getSubmission } from '@/lib/elasticsearch';
import { prisma } from '@/lib/db';
import type { ActingUser } from '@/lib/auth';
import { logAudit } from './auditService';
import { getAuthorAuthorization } from './authorAuthService';
import { shouldMaskForm, MASKED_FIELD_TYPES } from './maskingService';

/**
 * 마스킹된 값 개별 열람 (개인정보취급자 전용).
 *
 * 🔴 설계상 중요한 점: 목록 응답에는 **원문을 절대 싣지 않는다.** 원문을 함께 내려보내고
 * 화면에서만 가리면, 개발자 도구로 네트워크 응답을 열어보는 것만으로 마스킹이 무력화된다
 * (워드클라우드·지도에서 지킨 것과 같은 원칙). 그래서 열람은 셀 단위의 **별도 요청**이며,
 * 요청마다 권한을 다시 확인하고 감사 로그를 남긴다.
 *
 * "한 번 열면 계속 보이는" 전체 해제를 두지 않는 이유도 같다 — 해제 상태로 방치되면
 * 마스킹이 사실상 없는 것과 같아지고, 무엇을 언제 봤는지도 남지 않는다.
 */

export type RevealDenial = 'NOT_FOUND' | 'NOT_MASKED' | 'FORBIDDEN' | 'NOT_MASKABLE_FIELD';

export interface RevealResult {
  ok: true;
  value: string;
}
export interface RevealFailure {
  ok: false;
  reason: RevealDenial;
  message: string;
}

const MESSAGES: Record<RevealDenial, string> = {
  NOT_FOUND: '해당 응답 또는 문항을 찾을 수 없습니다.',
  NOT_MASKED: '이 양식지는 마스킹 대상이 아닙니다.',
  FORBIDDEN: '개인정보 취급자 승인을 받은 계정만 마스킹된 값을 열람할 수 있습니다.',
  NOT_MASKABLE_FIELD: '이 문항은 마스킹 대상 문항이 아닙니다.',
};

export async function revealMaskedField(
  formId: string,
  submissionId: string,
  fieldId: string,
  actor: ActingUser
): Promise<RevealResult | RevealFailure> {
  const fail = (reason: RevealDenial): RevealFailure => ({ ok: false, reason, message: MESSAGES[reason] });

  const registry = await prisma.formRegistry.findUnique({
    where: { id: formId },
    select: { authorHadPrivacyAuth: true, maskingExemptedAt: true },
  });
  if (!registry) return fail('NOT_FOUND');
  // 마스킹 대상이 아니면 이 경로를 쓸 이유가 없다(이미 값이 그대로 보인다).
  if (!shouldMaskForm(registry)) return fail('NOT_MASKED');

  // 개인정보 취급자 승인(APPROVED)만 허용한다. 정지·만료·해제 상태는 열람 불가 —
  // 자격이 유효하지 않은 동안에는 마스킹이 그대로 유지되어야 한다.
  const auth = await getAuthorAuthorization(actor.id);
  if (!auth || auth.status !== 'APPROVED') {
    await logAudit({
      userEmail: actor.email,
      action: 'MASK_REVEAL_DENIED',
      target: `Submission [${formId}/${submissionId}] field [${fieldId}]`,
      details: `마스킹 열람 거부 — 개인정보 취급자 자격 없음(${auth?.status ?? 'NONE'})`,
      severity: 'warning',
      formId,
    });
    return fail('FORBIDDEN');
  }

  const template = await getFormTemplate(formId);
  const field = template?.fields.find((f) => f.id === fieldId);
  if (!field) return fail('NOT_FOUND');
  // 익명 문항은 응답자와 분리 저장되어 이 경로로 접근할 대상이 아니다.
  if (field.anonymous) return fail('NOT_FOUND');
  if (!MASKED_FIELD_TYPES.has(field.type)) return fail('NOT_MASKABLE_FIELD');

  const doc = await getSubmission(formId, submissionId);
  if (!doc) return fail('NOT_FOUND');

  const raw = doc.data?.[fieldId];
  const value = raw === undefined || raw === null ? '' : String(raw);

  // 무엇을, 누가, 언제 봤는지 남긴다. 열람 자체가 개인정보 처리 행위다.
  await logAudit({
    userEmail: actor.email,
    action: 'MASK_REVEAL',
    target: `Submission [${formId}/${submissionId}] field [${fieldId}]`,
    details: `마스킹 값 열람 — 문항 "${field.label}"`,
    severity: 'warning',
    formId,
  });

  return { ok: true, value };
}
