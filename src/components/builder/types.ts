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
  | 'image' | 'image-viewer' | 'table' | 'file-upload' | 'comment-thread'
  | 'slide-card' | 'popup-toggle' | 'privacy-consent' | 'api-select' | 'csv-select'
  | 'regex-input' | 'map-address';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  nullable?: boolean; // Null 허용 여부 명시적 처리
  options?: string[]; // for select, radio, checkbox
  regexPattern?: string; // 전화번호, 주민번호, 사업자번호 등 검증용
  privacyMasking?: boolean; // 비식별화 (마스킹) 플래그
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
