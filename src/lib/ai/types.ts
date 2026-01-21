// AI-specific types for document analysis and form autofill

export interface ExtractedField {
  field_name: string;
  value: string | null;
  confidence: number; // 0-1
  source_location?: string; // Where in the document this was found
  requires_verification: boolean;
}

export interface DocumentAnalysisResult {
  document_type: string;
  extracted_fields: ExtractedField[];
  overall_confidence: number;
  processing_time_ms: number;
  raw_text?: string;
  warnings?: string[];
  errors?: string[];
}

export interface PassportData {
  full_name: string | null;
  given_name: string | null;
  surname: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  passport_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  sex: string | null;
  mrz_line_1?: string;
  mrz_line_2?: string;
}

export interface BirthCertificateData {
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  father_name: string | null;
  mother_name: string | null;
  certificate_number: string | null;
  registration_date: string | null;
}

export interface MarriageCertificateData {
  spouse_1_name: string | null;
  spouse_2_name: string | null;
  date_of_marriage: string | null;
  place_of_marriage: string | null;
  certificate_number: string | null;
  officiant_name: string | null;
}

export interface EmploymentLetterData {
  employee_name: string | null;
  employer_name: string | null;
  job_title: string | null;
  start_date: string | null;
  salary: string | null;
  employment_type: string | null;
  letter_date: string | null;
}

export interface BankStatementData {
  account_holder: string | null;
  bank_name: string | null;
  account_number: string | null;
  statement_period: string | null;
  ending_balance: string | null;
  average_balance: string | null;
}

export type DocumentData =
  | PassportData
  | BirthCertificateData
  | MarriageCertificateData
  | EmploymentLetterData
  | BankStatementData
  | Record<string, string | null>;

export interface FormField {
  field_id: string;
  field_name: string;
  field_type: 'text' | 'date' | 'select' | 'checkbox' | 'radio' | 'textarea';
  current_value?: string;
  suggested_value?: string;
  confidence?: number;
  source_document?: string;
  requires_review?: boolean;
}

export interface FormAutofillResult {
  form_type: string;
  fields: FormField[];
  overall_confidence: number;
  processing_time_ms: number;
  missing_documents?: string[];
  warnings?: string[];
}

export interface AIProviderConfig {
  openai_api_key?: string;
  anthropic_api_key?: string;
  default_model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AnalysisOptions {
  document_type?: string;
  extract_raw_text?: boolean;
  high_accuracy_mode?: boolean;
}

export interface AutofillOptions {
  form_type: string;
  case_id: string;
  use_all_documents?: boolean;
  document_ids?: string[];
  validate_fields?: boolean;
}
