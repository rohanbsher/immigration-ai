// User Types
export type UserRole = 'attorney' | 'client' | 'admin';

// Case Types
export type CaseStatus =
  | 'intake'
  | 'document_collection'
  | 'in_review'
  | 'forms_preparation'
  | 'ready_for_filing'
  | 'filed'
  | 'pending_response'
  | 'approved'
  | 'denied'
  | 'closed';

export type VisaType =
  | 'B1B2'
  | 'F1'
  | 'H1B'
  | 'H4'
  | 'L1'
  | 'O1'
  | 'EB1'
  | 'EB2'
  | 'EB3'
  | 'EB5'
  | 'I-130'
  | 'I-485'
  | 'I-765'
  | 'I-131'
  | 'N-400'
  | 'other';

// Document Types
export type DocumentType =
  | 'passport'
  | 'visa'
  | 'i94'
  | 'birth_certificate'
  | 'marriage_certificate'
  | 'divorce_certificate'
  | 'employment_letter'
  | 'pay_stub'
  | 'tax_return'
  | 'w2'
  | 'bank_statement'
  | 'photo'
  | 'medical_exam'
  | 'police_clearance'
  | 'diploma'
  | 'transcript'
  | 'recommendation_letter'
  | 'utility_bill'
  | 'other';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'analyzed'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'expired';

// Form Types
export type FormType =
  | 'I-130'
  | 'I-485'
  | 'I-765'
  | 'I-131'
  | 'I-140'
  | 'I-129'
  | 'I-539'
  | 'I-20'
  | 'DS-160'
  | 'N-400'
  | 'G-1145';

export type FormStatus =
  | 'draft'
  | 'autofilling'
  | 'ai_filled'
  | 'in_review'
  | 'needs_review'
  | 'approved'
  | 'filed'
  | 'rejected';

// Activity/Audit Types
export type ActivityType =
  | 'case_created'
  | 'case_updated'
  | 'document_uploaded'
  | 'document_analyzed'
  | 'document_verified'
  | 'form_created'
  | 'form_ai_filled'
  | 'form_reviewed'
  | 'form_filed'
  | 'note_added'
  | 'status_changed';

// Access Control Types
export interface CaseAccessResult {
  hasAccess: boolean;
  /** The case owner's attorney ID, useful for quota checks */
  attorneyId?: string;
}

// Repeatable Section Types (USCIS Forms)

/** Entry in a 5-year address history (repeatable section on USCIS forms). */
export interface AddressHistoryEntry {
  street: string;
  apt?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  from_date: string;   // YYYY-MM format
  to_date: string;     // YYYY-MM or "present"
}

/** Entry in employment history (repeatable section on USCIS forms). */
export interface EmploymentHistoryEntry {
  employer_name: string;
  employer_address?: string;
  employer_city?: string;
  employer_state?: string;
  employer_zip?: string;
  employer_country?: string;
  job_title: string;
  from_date: string;   // YYYY-MM format
  to_date: string;     // YYYY-MM or "present"
  duties?: string;
}

/** Entry in education history. */
export interface EducationHistoryEntry {
  institution_name: string;
  institution_city?: string;
  institution_state?: string;
  institution_country?: string;
  degree_type: string;
  field_of_study: string;
  graduation_date: string;  // YYYY-MM format
  gpa?: string;
}

