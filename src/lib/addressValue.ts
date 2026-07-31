/**
 * 주소 문항(`map-address`)의 저장 값 구조 (docs/주소입력-지도분포-설계.md §2-1).
 *
 * 검색 결과를 문자열 하나로 뭉쳐 저장하면 "서울시" vs "서울특별시" 같은 표기 흔들림이
 * 그대로 남아 지역 집계가 깨진다. 구조화해서 저장하되, 특히 **법정동코드(bcode)**가
 * 중요하다 — 좌표(지오코딩) 없이도 시·군·구 단위 분포 분석이 가능해지기 때문이다.
 *
 * 서버·클라이언트 양쪽에서 쓰므로 서버 전용 의존성 없는 순수 모듈로 둔다.
 */

export interface AddressValue {
  postcode: string; // 우편번호(5자리)
  roadAddress: string; // 도로명주소
  jibunAddress?: string; // 지번주소
  /** 응답자가 직접 입력하는 동/호수 등. 지도·집계에는 절대 쓰지 않는다(§2-1). */
  detail: string;
  bcode?: string; // 법정동코드 — 행정구역 집계의 키
  sido?: string; // 시/도
  sigungu?: string; // 시/군/구
  bname?: string; // 법정동/리
}

export function isAddressValue(v: unknown): v is AddressValue {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.roadAddress === 'string' && typeof o.postcode === 'string';
}

/** 화면·CSV에 한 줄로 보여줄 때 쓰는 표기. 상세주소까지 포함한 "사람이 읽는" 형태다. */
export function formatAddress(v: AddressValue | undefined): string {
  if (!v) return '';
  const base = v.roadAddress || v.jibunAddress || '';
  const detail = v.detail?.trim();
  const post = v.postcode ? `(${v.postcode}) ` : '';
  return `${post}${base}${detail ? ` ${detail}` : ''}`.trim();
}

/**
 * 기존에 문자열로 저장된 값과의 호환 — 구조화 이전 응답은 문자열이다.
 * 파싱을 시도하지 않고 `roadAddress`에 통째로 넣는다. 억지로 쪼개면 잘못된 행정구역으로
 * 집계될 수 있어, 오히려 "집계 불가(bcode 없음)"로 남겨두는 편이 안전하다.
 */
export function coerceAddressValue(raw: unknown): AddressValue | undefined {
  if (isAddressValue(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    return { postcode: '', roadAddress: raw.trim(), detail: '' };
  }
  return undefined;
}
