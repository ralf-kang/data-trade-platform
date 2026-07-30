/**
 * 개인정보 수집·이용 동의서(§동의서 컴포넌트) 법정 필수 고지사항 및 문구 자동 생성.
 *
 * 「개인정보 보호법」 제15조(수집·이용)·제17조(제3자 제공) 동의를 받을 때 정보주체에게
 * 고지해야 하는 최소 항목을 관리자가 구조화된 값으로 입력하면, 그 값으로 실제 동의서
 * 문구를 조립해 응답자에게 그대로 보여준다 — 제작자가 매번 법정 문구를 손으로 베껴
 * 쓰다가 항목을 빠뜨리는 사고를 막기 위함이다.
 *
 * 클라이언트 컴포넌트(FormBuilder 미리보기, FormClient 응답 화면) 양쪽에서 동일하게
 * 써야 "빌더에서 본 문구"와 "응답자가 실제로 본 문구"가 어긋나지 않으므로, 서버 전용
 * 의존성 없는 순수 함수로 둔다.
 */

export interface ThirdPartyProvision {
  recipient: string; // 제공받는 자
  purpose: string; // 제공 목적
  items: string; // 제공 항목
  retentionPeriod: string; // 보유·이용 기간(제공받는 자 기준)
}

export interface PrivacyConsentMeta {
  purpose: string; // 수집·이용 목적 (제15조 제1항 제1호)
  items: string; // 수집 항목 (제15조 제1항 제1호)
  retentionPeriod: string; // 보유·이용 기간 (제15조 제1항 제1호)
  /** 동의 거부 시 불이익 안내 — 비워두면 기본 문구를 쓴다 (제15조 제2항 제4호는 필수 고지 항목). */
  refusalConsequence?: string;
  /** 제3자 제공이 있는 경우만(제17조) — 없으면 해당 절은 문구에서 생략된다. */
  thirdParty?: ThirdPartyProvision;
}

const DEFAULT_REFUSAL_CONSEQUENCE =
  '동의를 거부할 권리가 있으며, 동의 거부 시 관련 서비스 이용에 제한이 있을 수 있습니다.';

export function isConsentMetaComplete(meta: PrivacyConsentMeta | undefined): boolean {
  if (!meta) return false;
  return !!(meta.purpose?.trim() && meta.items?.trim() && meta.retentionPeriod?.trim());
}

/** 관리자가 입력한 구조화 값으로 실제 동의서 문구(정보주체에게 보여줄 최종 텍스트)를 조립한다. */
export function buildConsentText(meta: PrivacyConsentMeta | undefined): string {
  if (!isConsentMetaComplete(meta)) {
    return '⚠ 아직 필수 항목이 입력되지 않았습니다. 좌측 상세 설정에서 수집 목적·항목·보유기간을 입력해주세요.';
  }
  const m = meta!;
  const lines: string[] = [];
  lines.push('■ 개인정보 수집·이용 동의');
  lines.push(`1. 수집·이용 목적: ${m.purpose}`);
  lines.push(`2. 수집 항목: ${m.items}`);
  lines.push(`3. 보유 및 이용 기간: ${m.retentionPeriod}`);
  lines.push(`4. ${m.refusalConsequence?.trim() || DEFAULT_REFUSAL_CONSEQUENCE}`);

  if (m.thirdParty && (m.thirdParty.recipient?.trim() || m.thirdParty.purpose?.trim())) {
    const tp = m.thirdParty;
    lines.push('');
    lines.push('■ 개인정보 제3자 제공 동의');
    lines.push(`1. 제공받는 자: ${tp.recipient || '(미입력)'}`);
    lines.push(`2. 제공 목적: ${tp.purpose || '(미입력)'}`);
    lines.push(`3. 제공 항목: ${tp.items || '(미입력)'}`);
    lines.push(`4. 보유 및 이용 기간: ${tp.retentionPeriod || '(미입력)'}`);
  }

  lines.push('');
  lines.push('위 내용을 확인하였으며, 이에 동의합니다.');
  return lines.join('\n');
}
