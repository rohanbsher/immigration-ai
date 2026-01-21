// Form field and section type definitions

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'alien_number'
  | 'country'
  | 'state'
  | 'address';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  min?: number;
  max?: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  defaultValue?: string | boolean | number;
  conditional?: {
    field: string;
    value: string | boolean | string[];
  };
  width?: 'full' | 'half' | 'third';
  aiMappable?: boolean; // Can be auto-filled from extracted document data
  aiFieldKey?: string; // Key to map from AI extraction results
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  repeatable?: boolean;
  maxRepeat?: number;
}

export interface FormDefinition {
  formType: string;
  title: string;
  version: string;
  uscisFormNumber: string;
  expirationDate?: string;
  sections: FormSection[];
  instructions?: string;
  estimatedTime?: string;
  filingFee?: number;
}

// Helper to create required text field
export function requiredText(
  id: string,
  label: string,
  options?: Partial<FormField>
): FormField {
  return {
    id,
    name: id,
    label,
    type: 'text',
    validation: { required: true },
    aiMappable: true,
    ...options,
  };
}

// Helper to create optional text field
export function optionalText(
  id: string,
  label: string,
  options?: Partial<FormField>
): FormField {
  return {
    id,
    name: id,
    label,
    type: 'text',
    aiMappable: true,
    ...options,
  };
}

// Helper to create date field
export function dateField(
  id: string,
  label: string,
  required = false,
  options?: Partial<FormField>
): FormField {
  return {
    id,
    name: id,
    label,
    type: 'date',
    validation: required ? { required: true } : undefined,
    aiMappable: true,
    ...options,
  };
}

// Helper to create select field
export function selectField(
  id: string,
  label: string,
  fieldOptions: FieldOption[],
  required = false,
  options?: Partial<FormField>
): FormField {
  return {
    id,
    name: id,
    label,
    type: 'select',
    options: fieldOptions,
    validation: required ? { required: true } : undefined,
    ...options,
  };
}

// Helper to create yes/no radio
export function yesNoField(
  id: string,
  label: string,
  required = false,
  options?: Partial<FormField>
): FormField {
  return {
    id,
    name: id,
    label,
    type: 'radio',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    validation: required ? { required: true } : undefined,
    ...options,
  };
}
