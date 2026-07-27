export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'date' 
  | 'file' 
  | 'signature';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for select, radio, checkbox
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
