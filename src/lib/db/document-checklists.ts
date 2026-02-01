import type { VisaType, DocumentType } from '@/types';

export interface DocumentChecklistItem {
  documentType: DocumentType;
  name: string;
  description: string;
  required: boolean;
  category: 'identity' | 'employment' | 'education' | 'financial' | 'legal' | 'medical' | 'other';
  notes?: string;
}

export interface DocumentChecklist {
  visaType: VisaType;
  name: string;
  description: string;
  items: DocumentChecklistItem[];
}

const COMMON_IDENTITY_DOCS: DocumentChecklistItem[] = [
  {
    documentType: 'passport',
    name: 'Valid Passport',
    description: 'Current passport with at least 6 months validity',
    required: true,
    category: 'identity',
  },
  {
    documentType: 'photo',
    name: 'Passport-Style Photos',
    description: '2x2 inch photos meeting USCIS requirements',
    required: true,
    category: 'identity',
  },
  {
    documentType: 'birth_certificate',
    name: 'Birth Certificate',
    description: 'Original or certified copy with translation if not in English',
    required: true,
    category: 'identity',
  },
];

const EMPLOYMENT_DOCS: DocumentChecklistItem[] = [
  {
    documentType: 'employment_letter',
    name: 'Employment Verification Letter',
    description: 'Letter from employer on company letterhead',
    required: true,
    category: 'employment',
  },
  {
    documentType: 'pay_stub',
    name: 'Recent Pay Stubs',
    description: 'Last 3 months of pay stubs',
    required: true,
    category: 'financial',
  },
  {
    documentType: 'w2',
    name: 'W-2 Forms',
    description: 'W-2 forms for past 2-3 years',
    required: true,
    category: 'financial',
  },
  {
    documentType: 'tax_return',
    name: 'Tax Returns',
    description: 'Federal tax returns for past 3 years',
    required: true,
    category: 'financial',
  },
];

const EDUCATION_DOCS: DocumentChecklistItem[] = [
  {
    documentType: 'diploma',
    name: 'Degree Certificate/Diploma',
    description: 'Original or certified copies of all degrees',
    required: true,
    category: 'education',
  },
  {
    documentType: 'transcript',
    name: 'Academic Transcripts',
    description: 'Official transcripts from all educational institutions',
    required: true,
    category: 'education',
  },
];

const DOCUMENT_CHECKLISTS: Record<VisaType, DocumentChecklist> = {
  H1B: {
    visaType: 'H1B',
    name: 'H-1B Specialty Occupation Visa',
    description: 'Documents required for H-1B visa petition',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      ...EDUCATION_DOCS,
      {
        documentType: 'recommendation_letter',
        name: 'Expert Opinion Letters',
        description: 'Letters from experts in your field (if applicable)',
        required: false,
        category: 'other',
        notes: 'Recommended for specialty occupation evidence',
      },
    ],
  },
  H4: {
    visaType: 'H4',
    name: 'H-4 Dependent Visa',
    description: 'Documents required for H-4 dependent visa',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'marriage_certificate',
        name: 'Marriage Certificate',
        description: 'Original marriage certificate with translation if needed',
        required: true,
        category: 'legal',
      },
      {
        documentType: 'other',
        name: "Principal's H-1B Approval",
        description: "Copy of principal applicant's I-797 approval notice",
        required: true,
        category: 'legal',
      },
    ],
  },
  L1: {
    visaType: 'L1',
    name: 'L-1 Intracompany Transferee',
    description: 'Documents required for L-1 visa petition',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      {
        documentType: 'other',
        name: 'Employment History Evidence',
        description: 'Evidence of 1+ year employment with foreign company',
        required: true,
        category: 'employment',
      },
      {
        documentType: 'other',
        name: 'Company Relationship Documentation',
        description: 'Evidence of qualifying relationship between US and foreign entity',
        required: true,
        category: 'employment',
      },
    ],
  },
  O1: {
    visaType: 'O1',
    name: 'O-1 Extraordinary Ability',
    description: 'Documents required for O-1 visa petition',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      {
        documentType: 'recommendation_letter',
        name: 'Advisory Opinion Letter',
        description: 'Letter from peer group or labor organization',
        required: true,
        category: 'other',
      },
      {
        documentType: 'recommendation_letter',
        name: 'Recommendation Letters',
        description: 'Letters from experts attesting to extraordinary ability',
        required: true,
        category: 'other',
      },
      {
        documentType: 'other',
        name: 'Awards/Recognition Evidence',
        description: 'Documentation of major awards, publications, or recognition',
        required: true,
        category: 'other',
      },
    ],
  },
  F1: {
    visaType: 'F1',
    name: 'F-1 Student Visa',
    description: 'Documents required for F-1 student visa',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'other',
        name: 'Form I-20',
        description: 'Certificate of Eligibility from the school',
        required: true,
        category: 'education',
      },
      {
        documentType: 'bank_statement',
        name: 'Financial Support Evidence',
        description: 'Bank statements showing sufficient funds for study',
        required: true,
        category: 'financial',
      },
      ...EDUCATION_DOCS,
    ],
  },
  B1B2: {
    visaType: 'B1B2',
    name: 'B-1/B-2 Visitor Visa',
    description: 'Documents required for visitor visa',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'bank_statement',
        name: 'Bank Statements',
        description: 'Recent bank statements showing financial stability',
        required: true,
        category: 'financial',
      },
      {
        documentType: 'employment_letter',
        name: 'Employment Letter',
        description: 'Letter confirming employment and approved leave',
        required: false,
        category: 'employment',
      },
    ],
  },
  EB1: {
    visaType: 'EB1',
    name: 'EB-1 Employment-Based First Preference',
    description: 'Documents required for EB-1 green card',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      ...EDUCATION_DOCS,
      {
        documentType: 'recommendation_letter',
        name: 'Reference Letters',
        description: 'Letters from experts in your field',
        required: true,
        category: 'other',
      },
      {
        documentType: 'other',
        name: 'Extraordinary Ability Evidence',
        description: 'Publications, citations, awards, memberships',
        required: true,
        category: 'other',
      },
      {
        documentType: 'medical_exam',
        name: 'Medical Examination (I-693)',
        description: 'Civil surgeon medical examination',
        required: true,
        category: 'medical',
      },
      {
        documentType: 'police_clearance',
        name: 'Police Clearance Certificates',
        description: 'From all countries of residence',
        required: true,
        category: 'legal',
      },
    ],
  },
  EB2: {
    visaType: 'EB2',
    name: 'EB-2 Employment-Based Second Preference',
    description: 'Documents required for EB-2 green card',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      ...EDUCATION_DOCS,
      {
        documentType: 'other',
        name: 'Labor Certification (PERM)',
        description: 'Approved labor certification (unless NIW)',
        required: true,
        category: 'employment',
      },
      {
        documentType: 'recommendation_letter',
        name: 'Reference Letters',
        description: 'Letters supporting qualifications',
        required: true,
        category: 'other',
      },
      {
        documentType: 'medical_exam',
        name: 'Medical Examination (I-693)',
        description: 'Civil surgeon medical examination',
        required: true,
        category: 'medical',
      },
      {
        documentType: 'police_clearance',
        name: 'Police Clearance Certificates',
        description: 'From all countries of residence',
        required: true,
        category: 'legal',
      },
    ],
  },
  EB3: {
    visaType: 'EB3',
    name: 'EB-3 Employment-Based Third Preference',
    description: 'Documents required for EB-3 green card',
    items: [
      ...COMMON_IDENTITY_DOCS,
      ...EMPLOYMENT_DOCS,
      ...EDUCATION_DOCS,
      {
        documentType: 'other',
        name: 'Labor Certification (PERM)',
        description: 'Approved labor certification',
        required: true,
        category: 'employment',
      },
      {
        documentType: 'medical_exam',
        name: 'Medical Examination (I-693)',
        description: 'Civil surgeon medical examination',
        required: true,
        category: 'medical',
      },
      {
        documentType: 'police_clearance',
        name: 'Police Clearance Certificates',
        description: 'From all countries of residence',
        required: true,
        category: 'legal',
      },
    ],
  },
  EB5: {
    visaType: 'EB5',
    name: 'EB-5 Investor Visa',
    description: 'Documents required for EB-5 investor visa',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'bank_statement',
        name: 'Source of Funds Documentation',
        description: 'Evidence of lawful source of investment funds',
        required: true,
        category: 'financial',
      },
      {
        documentType: 'tax_return',
        name: 'Tax Returns',
        description: 'Personal and business tax returns',
        required: true,
        category: 'financial',
      },
      {
        documentType: 'other',
        name: 'Business Plan',
        description: 'Comprehensive business plan for the investment',
        required: true,
        category: 'other',
      },
      {
        documentType: 'medical_exam',
        name: 'Medical Examination (I-693)',
        description: 'Civil surgeon medical examination',
        required: true,
        category: 'medical',
      },
      {
        documentType: 'police_clearance',
        name: 'Police Clearance Certificates',
        description: 'From all countries of residence',
        required: true,
        category: 'legal',
      },
    ],
  },
  'I-130': {
    visaType: 'I-130',
    name: 'I-130 Petition for Alien Relative',
    description: 'Documents required for family-based petition',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'marriage_certificate',
        name: 'Marriage Certificate',
        description: 'If petitioning for spouse',
        required: false,
        category: 'legal',
      },
      {
        documentType: 'other',
        name: "Petitioner's Citizenship/LPR Evidence",
        description: 'US passport, naturalization certificate, or green card',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'other',
        name: 'Relationship Evidence',
        description: 'Photos, correspondence, joint documents',
        required: true,
        category: 'other',
      },
    ],
  },
  'I-485': {
    visaType: 'I-485',
    name: 'I-485 Adjustment of Status',
    description: 'Documents required for adjustment of status',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'i94',
        name: 'I-94 Arrival/Departure Record',
        description: 'Most recent I-94',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'visa',
        name: 'Current Visa',
        description: 'Copy of current visa stamp',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'medical_exam',
        name: 'Medical Examination (I-693)',
        description: 'Civil surgeon medical examination',
        required: true,
        category: 'medical',
      },
      {
        documentType: 'police_clearance',
        name: 'Police Clearance Certificates',
        description: 'From all countries of residence after age 16',
        required: true,
        category: 'legal',
      },
      {
        documentType: 'tax_return',
        name: 'Tax Returns',
        description: 'Federal tax returns for past 3 years',
        required: true,
        category: 'financial',
      },
    ],
  },
  'I-765': {
    visaType: 'I-765',
    name: 'I-765 Employment Authorization',
    description: 'Documents required for EAD application',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'i94',
        name: 'I-94 Arrival/Departure Record',
        description: 'Most recent I-94',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'other',
        name: 'Previous EAD',
        description: 'Copy of previous EAD if renewal',
        required: false,
        category: 'identity',
      },
      {
        documentType: 'other',
        name: 'Eligibility Evidence',
        description: 'Documents supporting EAD eligibility category',
        required: true,
        category: 'legal',
      },
    ],
  },
  'I-131': {
    visaType: 'I-131',
    name: 'I-131 Travel Document',
    description: 'Documents required for advance parole/travel document',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'i94',
        name: 'I-94 Arrival/Departure Record',
        description: 'Most recent I-94',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'other',
        name: 'Previous Travel Documents',
        description: 'Copies of previous advance parole if renewal',
        required: false,
        category: 'identity',
      },
      {
        documentType: 'other',
        name: 'Pending Application Evidence',
        description: 'Receipt notice of pending I-485 or other application',
        required: true,
        category: 'legal',
      },
    ],
  },
  'N-400': {
    visaType: 'N-400',
    name: 'N-400 Naturalization Application',
    description: 'Documents required for US citizenship application',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'other',
        name: 'Green Card',
        description: 'Current permanent resident card',
        required: true,
        category: 'identity',
      },
      {
        documentType: 'tax_return',
        name: 'Tax Returns',
        description: 'Federal tax returns for past 5 years',
        required: true,
        category: 'financial',
      },
      {
        documentType: 'marriage_certificate',
        name: 'Marriage/Divorce Certificates',
        description: 'All marriage and divorce certificates',
        required: false,
        category: 'legal',
      },
      {
        documentType: 'other',
        name: 'Travel History',
        description: 'Record of all trips outside the US',
        required: true,
        category: 'other',
      },
    ],
  },
  other: {
    visaType: 'other',
    name: 'General Immigration Documents',
    description: 'Common documents for immigration applications',
    items: [
      ...COMMON_IDENTITY_DOCS,
      {
        documentType: 'i94',
        name: 'I-94 Arrival/Departure Record',
        description: 'Most recent I-94 if applicable',
        required: false,
        category: 'identity',
      },
      {
        documentType: 'visa',
        name: 'Current/Previous Visas',
        description: 'Copies of all US visas',
        required: false,
        category: 'identity',
      },
    ],
  },
};

export function getDocumentChecklist(visaType: VisaType): DocumentChecklist | null {
  return DOCUMENT_CHECKLISTS[visaType] || null;
}

export function getAllChecklists(): DocumentChecklist[] {
  return Object.values(DOCUMENT_CHECKLISTS);
}

export function getVisaTypes(): VisaType[] {
  return Object.keys(DOCUMENT_CHECKLISTS) as VisaType[];
}
