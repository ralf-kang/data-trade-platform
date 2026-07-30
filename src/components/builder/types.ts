export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'date' 
  | 'file' 
  | 'signature'
  | 'image' | 'image-gallery' | 'video-link' | 'image-viewer' | 'table' | 'file-upload'
  | 'nested-report' | 'report-link' | 'comment-thread'
  | 'slide-card' | 'popup-toggle' | 'privacy-consent' | 'api-select' | 'csv-select'
  | 'regex-input' | 'map-address';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  nullable?: boolean; // Null 허용 여부 명시적 처리
  width?: '100%' | '50%'; // 레이아웃 조절용 (전체 너비 vs 절반 너비)
  options?: string[]; // for select, radio, checkbox
  regexPattern?: string; // 전화번호, 주민번호, 사업자번호 등 검증용
  privacyMasking?: boolean; // 비식별화 (마스킹) 플래그
  /**
   * 이 문항의 응답을 응답자와 분리해 익명 저장한다(2단계).
   * true인 문항은 식별 문서에 저장되지 않고 별도 인덱스에 셔플 적재되며,
   * 양식이 확정(PUBLISHED)된 뒤에는 값을 바꿀 수 없다 — 이미 응답한 사람들과의
   * 약속이 되기 때문이다 (formService.updateForm에서 강제).
   */
  anonymous?: boolean;
  /**
   * 이 문항이 개인식별자(사번·전화번호·이메일 등)인지 제작자가 직접 표시한 값.
   * 시스템이 값 포맷으로 추론하지 않는다 — 태그되지 않은 문항은 개인식별자로 간주하지
   * 않는다. 양식지 관계(온톨로지) 캔버스에서 연결·미리보기 블러 처리 판정 기준으로 쓰인다
   * (docs/양식지-관계-온톨로지-설계.md §5-3).
   */
  personalIdentifier?: boolean;
  /**
   * LDAP/인사시스템 자동 채움(데이터 정확성 1단계, docs/데이터품질-검증구간-설계.md §5 순위1).
   * 값을 지정하면 응답자 신원이 LDAP 계정으로 확인된 경우 해당 속성값이 읽기 전용으로
   * 자동 채워진다 — 입력을 아예 없애는 것이 오탈자·불일치를 막는 가장 확실한 방법이기
   * 때문이다(사람이 직접 타이핑하지 않으면 오타 자체가 날 수 없다).
   */
  ldapAttribute?: 'employeeNo' | 'department' | 'position' | 'name' | 'email';
  /**
   * privacy-consent(개인정보 동의서) 전용 — 「개인정보 보호법」이 요구하는 법정 필수
   * 고지사항(수집 목적/항목/보유기간, 필요 시 제3자 제공)을 구조화해서 담는다.
   * 응답 화면에 보여줄 문구는 이 값으로부터 자동 생성한다(src/lib/privacyConsentText.ts)
   * — 제작자가 매번 법정 문구를 손으로 옮겨 적다가 항목을 빠뜨리는 것을 막기 위함이다.
   */
  consentMeta?: {
    purpose: string;
    items: string;
    retentionPeriod: string;
    refusalConsequence?: string;
    thirdParty?: {
      recipient: string;
      purpose: string;
      items: string;
      retentionPeriod: string;
    };
  };
  /**
   * 반복 수집(회차) 시 이전 회차 값을 어떻게 다룰지(3단계).
   *   carry-over         : 지난 값 그대로 (부서·직급처럼 잘 안 바뀌는 것)
   *   carry-with-confirm : 채우되 확인 체크 필수 (자격증 만료일처럼 무심코 넘기면 안 되는 것)
   *   clear              : 매번 새로 (이번 분기 실적 등)
   *
   * 기본값은 clear다. 제작자가 의식적으로 켜지 않는 한 이전 값이 따라오면 안 된다 —
   * 매번 달라야 하는 항목이 조용히 복사되면 낡은 값이 최신 데이터로 둔갑한다.
   */
  prefillPolicy?: 'carry-over' | 'carry-with-confirm' | 'clear';
  autoDismissSeconds?: number; // 팝업 토글 전용
  apiEndpoint?: string; // 외부 연동용
  description?: string;
  i18n?: Record<string, { label?: string; placeholder?: string; options?: string[] }>; // 다국어 지원 (ex: { en: { label: 'Name' } })
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}
