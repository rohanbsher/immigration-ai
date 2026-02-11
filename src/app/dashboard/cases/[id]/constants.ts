import type { CaseStatus, FormType, VisaType } from '@/types';

export const statusOptions: { value: CaseStatus; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'document_collection', label: 'Document Collection' },
  { value: 'in_review', label: 'In Review' },
  { value: 'forms_preparation', label: 'Forms Preparation' },
  { value: 'ready_for_filing', label: 'Ready for Filing' },
  { value: 'filed', label: 'Filed' },
  { value: 'pending_response', label: 'Pending Response' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'closed', label: 'Closed' },
];

export const visaTypeOptions: { value: VisaType; label: string }[] = [
  { value: 'B1B2', label: 'B-1/B-2 Visitor Visa' },
  { value: 'F1', label: 'F-1 Student Visa' },
  { value: 'H1B', label: 'H-1B Specialty Occupation' },
  { value: 'H4', label: 'H-4 Dependent Visa' },
  { value: 'L1', label: 'L-1 Intracompany Transferee' },
  { value: 'O1', label: 'O-1 Extraordinary Ability' },
  { value: 'EB1', label: 'EB-1 Priority Worker' },
  { value: 'EB2', label: 'EB-2 Advanced Degree' },
  { value: 'EB3', label: 'EB-3 Skilled Worker' },
  { value: 'EB5', label: 'EB-5 Immigrant Investor' },
  { value: 'I-130', label: 'I-130 Petition for Alien Relative' },
  { value: 'I-485', label: 'I-485 Adjustment of Status' },
  { value: 'I-765', label: 'I-765 Employment Authorization' },
  { value: 'I-131', label: 'I-131 Travel Document' },
  { value: 'N-400', label: 'N-400 Naturalization' },
  { value: 'other', label: 'Other' },
];

export const formTypeOptions: { value: FormType; label: string }[] = [
  { value: 'I-130', label: 'I-130 - Petition for Alien Relative' },
  { value: 'I-485', label: 'I-485 - Application to Register Permanent Residence' },
  { value: 'I-765', label: 'I-765 - Application for Employment Authorization' },
  { value: 'I-131', label: 'I-131 - Application for Travel Document' },
  { value: 'I-140', label: 'I-140 - Immigrant Petition for Alien Workers' },
  { value: 'I-129', label: 'I-129 - Petition for Nonimmigrant Worker' },
  { value: 'I-539', label: 'I-539 - Application to Extend/Change Nonimmigrant Status' },
  { value: 'N-400', label: 'N-400 - Application for Naturalization' },
];
