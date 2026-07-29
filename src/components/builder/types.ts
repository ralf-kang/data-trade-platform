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
