// User Types
export type UserRole = 'attorney' | 'client' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  mfaEnabled: boolean;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttorneyProfile extends User {
  role: 'attorney';
  barNumber: string;
  firmName?: string;
  specializations: VisaType[];
}

export interface ClientProfile extends User {
  role: 'client';
  dateOfBirth?: Date;
  countryOfBirth?: string;
  nationality?: string;
  alienNumber?: string;
}

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

export interface Case {
  id: string;
  attorneyId: string;
  clientId: string;
  visaType: VisaType;
  status: CaseStatus;
  title: string;
  description?: string;
  priorityDate?: Date;
  deadline?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseWithRelations extends Case {
  attorney: User;
  client: User;
  documents: Document[];
  forms: Form[];
}

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
  | 'other';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'analyzed'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'expired';

export interface Document {
  id: string;
  caseId: string;
  uploadedBy: string;
  documentType: DocumentType;
  status: DocumentStatus;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  aiExtractedData?: Record<string, unknown>;
  aiConfidenceScore?: number;
  verifiedBy?: string;
  verifiedAt?: Date;
  expirationDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  | 'ai_filled'
  | 'in_review'
  | 'approved'
  | 'filed'
  | 'rejected';

export interface Form {
  id: string;
  caseId: string;
  formType: FormType;
  status: FormStatus;
  formData: Record<string, unknown>;
  aiFilledData?: Record<string, unknown>;
  aiConfidenceScores?: Record<string, number>;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  filedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface Activity {
  id: string;
  caseId: string;
  userId: string;
  activityType: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Access Control Types
export interface CaseAccessResult {
  hasAccess: boolean;
  /** The case owner's attorney ID, useful for quota checks */
  attorneyId?: string;
}

