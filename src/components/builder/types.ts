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
  | 'image'
  | 'image-gallery'
  | 'video-link'
  | 'table'
  | 'nested-report'
  | 'comment-thread'
  | 'report-link'
  | 'slide-card'
  | 'popup-toggle'
  | 'privacy-consent'
  | 'api-select'
  | 'csv-select';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For dropdown, radio, checkbox, etc.
  privacyMasking?: boolean; // 비식별화 (마스킹) 플래그
  autoDismissSeconds?: number; // 팝업 토글 전용
  apiEndpoint?: string; // 외부 연동용
  description?: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}
