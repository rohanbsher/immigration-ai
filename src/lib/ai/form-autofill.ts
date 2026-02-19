// Form auto-fill service using Claude for reasoning

import {
  generateFormAutofill,
  validateFormData,
  analyzeDataConsistency,
} from './anthropic';
import { getFormDefinition } from '@/lib/forms/definitions';
import {
  FormAutofillResult,
  ExtractedField,
  FormField,
  DocumentAnalysisResult,
} from './types';

export interface FormAutofillInput {
  formType: string;
  caseId: string;
  documentAnalyses: DocumentAnalysisResult[];
  existingFormData?: Record<string, string>;
  visaType?: string;
  petitionerRelationship?: string;
}

export interface AutofillProgress {
  stage: 'gathering' | 'analyzing' | 'mapping' | 'validating' | 'complete' | 'error';
  progress: number;
  message: string;
}

/**
 * Main entry point for form autofill
 */
export async function autofillForm(
  input: FormAutofillInput,
  onProgress?: (progress: AutofillProgress) => void
): Promise<FormAutofillResult> {
  const reportProgress = (
    stage: AutofillProgress['stage'],
    progress: number,
    message: string
  ) => {
    if (onProgress) {
      onProgress({ stage, progress, message });
    }
  };

  try {
    // Step 1: Gather all extracted fields from document analyses
    reportProgress('gathering', 20, 'Gathering document data...');

    const allExtractedFields: ExtractedField[] = [];

    for (const analysis of input.documentAnalyses) {
      // Tag each field with its source document
      const taggedFields = analysis.extracted_fields.map((field) => ({
        ...field,
        source_location: `${analysis.document_type}: ${field.source_location || 'extracted'}`,
      }));
      allExtractedFields.push(...taggedFields);
    }

    if (allExtractedFields.length === 0) {
      return {
        form_type: input.formType,
        fields: [],
        overall_confidence: 0,
        processing_time_ms: 0,
        missing_documents: ['No document data available for autofill'],
        warnings: ['Please upload and analyze documents before attempting autofill'],
      };
    }

    // Step 2: Check data consistency across documents
    reportProgress('analyzing', 40, 'Analyzing data consistency...');

    const consistencyResult = await analyzeDataConsistency(
      input.documentAnalyses.map((a) => ({
        type: a.document_type,
        extractedFields: a.extracted_fields,
      }))
    );

    // Step 3: Generate form autofill using Claude
    reportProgress('mapping', 60, `Mapping data to ${input.formType} fields...`);

    const autofillResult = await generateFormAutofill({
      formType: input.formType,
      extractedData: allExtractedFields,
      existingFormData: input.existingFormData,
      caseContext: {
        visa_type: input.visaType,
        petitioner_relationship: input.petitionerRelationship,
      },
    });

    // Step 4: Add consistency warnings to results
    reportProgress('validating', 80, 'Validating autofill suggestions...');

    const warnings = [...(autofillResult.warnings || [])];

    for (const discrepancy of consistencyResult.discrepancies) {
      if (discrepancy.values.length > 1) {
        warnings.push(
          `Data discrepancy for "${discrepancy.field}": ${discrepancy.recommendation}`
        );
      }
    }

    // Mark fields that have discrepancies as requiring review
    const fieldsWithReviewFlags = autofillResult.fields.map((field) => {
      const hasDiscrepancy = consistencyResult.discrepancies.some(
        (d) =>
          d.field.toLowerCase().includes(field.field_name.toLowerCase()) ||
          field.field_name.toLowerCase().includes(d.field.toLowerCase())
      );

      return {
        ...field,
        requires_review: field.requires_review || hasDiscrepancy,
      };
    });

    reportProgress('complete', 100, 'Autofill complete');

    return {
      ...autofillResult,
      fields: fieldsWithReviewFlags,
      warnings,
    };
  } catch (error) {
    reportProgress(
      'error',
      0,
      `Autofill failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }
}

/**
 * Validate autofilled form data before submission
 */
export async function validateAutofill(
  formType: string,
  formData: Record<string, string>,
  visaType?: string
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  return validateFormData(formType, formData, { visa_type: visaType || '' });
}

/**
 * Get list of required documents for a form type
 */
export function getRequiredDocuments(
  formType: string,
  _visaType?: string
): string[] {
  const baseDocuments: Record<string, string[]> = {
    'I-129': [
      'Beneficiary passport',
      'Beneficiary resume/CV',
      'Employment offer letter with job details',
      'Labor Condition Application (LCA) approval (H-1B)',
      'Employer financial documents (tax returns, annual report)',
      'Educational credentials/diplomas',
      'Previous I-94 record (if in the U.S.)',
      'Pay stubs or W-2s (if currently employed)',
      'Organizational chart showing position',
    ],
    'I-130': [
      'Petitioner passport or birth certificate',
      'Petitioner proof of status (passport, naturalization certificate, or green card)',
      'Beneficiary passport',
      'Beneficiary birth certificate',
      'Marriage certificate (if filing for spouse)',
      'Proof of relationship',
    ],
    'I-131': [
      'Passport',
      'Green card (front and back) or I-94',
      'Passport-style photos',
      'Evidence of immigration status',
      'Travel itinerary or planned travel details',
      'Copy of I-485 receipt notice (if pending)',
    ],
    'I-140': [
      'Beneficiary passport',
      'Beneficiary resume/CV',
      'Employment letter with job details',
      'Labor certification (ETA Form 9089, if applicable)',
      'Educational credentials/diplomas',
      'Prevailing wage determination',
      'Employer financial documents',
    ],
    'I-485': [
      'Passport',
      'Birth certificate',
      'I-94 arrival/departure record',
      'Passport-style photos',
      'Medical examination (I-693)',
      'Affidavit of support (I-864)',
      'Evidence of lawful entry',
      'Tax returns or W-2s (for address and employment history)',
      'Utility bills or lease agreements (for address history)',
    ],
    'I-539': [
      'Passport (valid for at least 6 months)',
      'I-94 arrival/departure record',
      'Current approval notice or visa stamp',
      'Evidence of financial support',
      'Bank statements (recent 3 months)',
      'Employment letter (if employed)',
      'Dependent passports (if co-applicants)',
    ],
    'I-765': [
      'Passport',
      'I-94 arrival/departure record',
      'Passport-style photos',
      'Evidence of eligibility category',
    ],
    'I-20': [
      'Passport',
      'Financial documents (bank statements, sponsor letter)',
      'Academic transcripts',
      'Diploma or degree certificates',
      'Standardized test scores (TOEFL, GRE, GMAT)',
      'Acceptance letter from school',
    ],
    'DS-160': [
      'Passport',
      'Passport-style photo (digital)',
      'Travel itinerary',
      'Employment letter or enrollment letter',
      'Financial documents',
      'Previous U.S. visa (if applicable)',
      'I-20 or I-797 (if applicable)',
    ],
    'N-400': [
      'Green card (front and back)',
      'Passport',
      'Tax returns (5 years)',
      'Travel history documentation',
      'Marriage/divorce certificates',
      'Birth certificates of children',
      'W-2s (for employment history verification)',
    ],
    'G-1145': [
      'No supporting documents required',
    ],
  };

  return baseDocuments[formType] || [];
}

/**
 * Map extracted field to form field ID based on form type
 */
export function mapExtractedFieldToFormField(
  extractedField: ExtractedField,
  formType: string
): FormField | null {
  // Field mapping definitions — maps extracted field names to form field IDs.
  // Covers passport, birth cert, marriage cert, I-94, W-2, employment letter,
  // diploma, transcript, and other cross-document sources.
  const fieldMappings: Record<string, Record<string, string>> = {
    'I-129': {
      // Beneficiary biographical (from passport)
      full_name: 'beneficiary_last_name',
      given_name: 'beneficiary_first_name',
      surname: 'beneficiary_last_name',
      date_of_birth: 'beneficiary_dob',
      place_of_birth: 'beneficiary_birth_city',
      nationality: 'beneficiary_nationality',
      passport_number: 'beneficiary_passport_number',
      expiry_date: 'beneficiary_passport_expiry',
      sex: 'beneficiary_sex',
      alien_number: 'beneficiary_alien_number',
      // From I-94
      i94_number: 'beneficiary_i94_number',
      admission_date: 'beneficiary_last_arrival_date',
      class_of_admission: 'beneficiary_last_arrival_status',
      admitted_until: 'beneficiary_status_expires',
      // From employment letter / W-2
      employer_name: 'petitioner_company_name',
      job_title: 'job_title',
      salary: 'offered_wage',
      // From diploma / transcript
      degree_type: 'pt7_highest_education',
      field_of_study: 'pt7_field_of_study',
      institution_name: 'pt7_institution_name',
    },
    'I-130': {
      // Beneficiary biographical (from passport)
      full_name: 'pt2_legal_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
      place_of_birth: 'pt2_pob_city',
      nationality: 'pt2_country_of_birth',
      passport_number: 'pt2_passport_number',
      // From birth certificate (family relationships)
      father_name: 'pt3_father_name',
      mother_name: 'pt3_mother_name',
      // From marriage certificate
      date_of_marriage: 'pt2_marriage_date',
      place_of_marriage: 'pt2_marriage_place',
      spouse_1_name: 'pt1_petitioner_name',
      spouse_2_name: 'pt2_beneficiary_name',
      // From utility bills / lease (address history)
      address: 'pt2_address_street',
    },
    'I-131': {
      full_name: 'pt1_legal_name',
      given_name: 'pt1_given_name',
      surname: 'pt1_family_name',
      date_of_birth: 'pt1_dob',
      place_of_birth: 'pt1_country_of_birth',
      nationality: 'pt1_nationality',
      passport_number: 'pt1_passport_number',
      alien_number: 'pt1_alien_number',
      // From I-94
      i94_number: 'pt1_i94_number',
      class_of_admission: 'class_of_admission',
    },
    'I-140': {
      // Beneficiary biographical (from passport)
      full_name: 'pt4_beneficiary_name',
      given_name: 'pt4_given_name',
      surname: 'pt4_family_name',
      date_of_birth: 'pt4_dob',
      place_of_birth: 'pt4_country_of_birth',
      nationality: 'pt4_nationality',
      passport_number: 'pt4_passport_number',
      alien_number: 'pt4_alien_number',
      expiry_date: 'pt4_passport_expiry',
      // From employment letter
      job_title: 'pt5_job_title',
      employer_name: 'pt1_employer_name',
      salary: 'pt5_offered_wage',
      // From diploma / transcript (education)
      degree_type: 'pt7_highest_education',
      field_of_study: 'pt7_field_of_study',
      institution_name: 'pt7_institution_name',
      institution_country: 'pt7_institution_country',
      graduation_date: 'pt7_degree_date',
      // From W-2 (employer verification)
      employer_ein: 'pt1_employer_ein',
      wages_tips: 'pt5_offered_wage',
    },
    'I-485': {
      // Applicant biographical (from passport)
      full_name: 'pt1_current_name',
      given_name: 'pt1_given_name',
      surname: 'pt1_family_name',
      date_of_birth: 'pt1_dob',
      place_of_birth: 'pt1_pob',
      nationality: 'pt1_country_of_birth',
      passport_number: 'pt1_passport_number',
      expiry_date: 'pt1_passport_expiry',
      sex: 'pt1_sex',
      alien_number: 'pt1_alien_number',
      // From I-94 (immigration history)
      i94_number: 'pt1_i94_number',
      admission_date: 'pt1_last_entry_date',
      class_of_admission: 'pt1_status_at_entry',
      admitted_until: 'pt1_status_expires',
      port_of_entry: 'pt1_port_of_entry',
      // From birth certificate (family relationships)
      father_name: 'pt3_father_name',
      mother_name: 'pt3_mother_name',
      // From marriage certificate
      date_of_marriage: 'pt3_marriage_date',
      place_of_marriage: 'pt3_marriage_place',
      // From W-2 / employment letter (employment history)
      employer_name: 'pt4_employer_name',
      job_title: 'pt4_occupation',
      // From utility bills / lease (address history)
      address: 'pt1_current_address',
    },
    'I-539': {
      // Applicant biographical (from passport)
      full_name: 'applicant_last_name',
      given_name: 'applicant_first_name',
      surname: 'applicant_last_name',
      date_of_birth: 'applicant_dob',
      place_of_birth: 'applicant_birth_city',
      nationality: 'applicant_nationality',
      passport_number: 'passport_number',
      expiry_date: 'passport_expiry',
      sex: 'applicant_sex',
      alien_number: 'applicant_alien_number',
      // From I-94 (immigration history)
      i94_number: 'i94_number',
      admission_date: 'date_of_last_arrival',
      class_of_admission: 'status_at_entry',
      admitted_until: 'current_status_expires',
      port_of_entry: 'port_of_entry',
      // From employment letter
      employer_name: 'employer_name',
    },
    'I-765': {
      full_name: 'pt2_legal_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
      nationality: 'pt2_nationality',
      passport_number: 'pt2_passport_number',
      alien_number: 'pt2_alien_number',
      // From I-94 (immigration history)
      i94_number: 'pt2_i94_number',
      admission_date: 'pt2_last_entry_date',
      class_of_admission: 'pt2_status_at_entry',
      admitted_until: 'pt2_status_expires',
      // From W-2 (employment verification)
      employer_name: 'pt2_employer_name',
    },
    'I-20': {
      // Student biographical (from passport)
      given_name: 'student_first_name',
      surname: 'student_last_name',
      date_of_birth: 'student_dob',
      place_of_birth: 'student_birth_country',
      nationality: 'student_nationality',
      passport_number: 'student_passport_number',
      // From transcript / diploma (education)
      institution_name: 'school_name',
      degree_type: 'education_level',
      field_of_study: 'program_name',
      graduation_date: 'program_end_date',
      cumulative_gpa: 'academic_gpa',
    },
    'DS-160': {
      // Biographical (from passport)
      full_name: 'last_name',
      given_name: 'first_name',
      surname: 'last_name',
      date_of_birth: 'dob',
      place_of_birth: 'birth_city',
      nationality: 'nationality',
      passport_number: 'passport_number',
      issue_date: 'passport_issue_date',
      expiry_date: 'passport_expiry_date',
      sex: 'sex',
      // From birth certificate (family)
      father_name: 'father_last_name',
      mother_name: 'mother_last_name',
      // From employment letter / W-2
      employer_name: 'current_employer_name',
      job_title: 'job_title',
    },
    'N-400': {
      // Applicant biographical (from passport)
      full_name: 'pt2_current_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
      place_of_birth: 'pt2_pob',
      nationality: 'pt2_nationality',
      alien_number: 'pt2_alien_number',
      // From marriage certificate
      date_of_marriage: 'pt6_marriage_date',
      spouse_1_name: 'pt6_spouse_name',
      // From birth certificate (family relationships)
      father_name: 'pt7_father_name',
      mother_name: 'pt7_mother_name',
      // From W-2 / tax returns (employment history)
      employer_name: 'pt8_employer_name',
      job_title: 'pt8_occupation',
      wages_tips: 'pt8_income',
      // From utility bills / lease (address history)
      address: 'pt3_current_address',
    },
    'G-1145': {
      given_name: 'applicant_first_name',
      surname: 'applicant_last_name',
    },
  };

  const mapping = fieldMappings[formType];
  if (!mapping) return null;

  const fieldId = mapping[extractedField.field_name];
  if (!fieldId) return null;

  return {
    field_id: fieldId,
    field_name: extractedField.field_name,
    field_type: 'text',
    suggested_value: extractedField.value || undefined,
    confidence: extractedField.confidence,
    source_document: extractedField.source_location,
    requires_review: extractedField.requires_verification,
  };
}

/**
 * Get unfilled required fields for a form
 */
export function getUnfilledRequiredFields(
  formType: string,
  currentFields: FormField[]
): string[] {
  const requiredFieldsByForm: Record<string, string[]> = {
    'I-129': [
      'petitioner_company_name',
      'petitioner_ein',
      'petitioner_address',
      'beneficiary_name',
      'beneficiary_dob',
      'beneficiary_nationality',
      'beneficiary_passport_number',
      'classification_requested',
      'job_title',
      'offered_wage',
    ],
    'I-130': [
      'petitioner_name',
      'petitioner_dob',
      'petitioner_address',
      'beneficiary_name',
      'beneficiary_dob',
      'relationship',
    ],
    'I-131': [
      'applicant_name',
      'applicant_dob',
      'immigration_status',
      'travel_document_type',
      'travel_purpose',
    ],
    'I-140': [
      'employer_name',
      'employer_address',
      'beneficiary_name',
      'beneficiary_dob',
      'job_title',
      'immigrant_category',
      'offered_wage',
    ],
    'I-485': [
      'applicant_name',
      'applicant_dob',
      'applicant_address',
      'country_of_birth',
      'date_of_entry',
    ],
    'I-539': [
      'applicant_name',
      'applicant_dob',
      'applicant_nationality',
      'passport_number',
      'current_status',
      'requested_status',
      'current_status_expires',
    ],
    'I-765': [
      'applicant_name',
      'applicant_dob',
      'eligibility_category',
    ],
    'I-20': [
      'school_name',
      'student_name',
      'student_dob',
      'student_nationality',
      'program_name',
      'program_start_date',
    ],
    'DS-160': [
      'last_name',
      'first_name',
      'dob',
      'birth_country',
      'nationality',
      'passport_number',
      'visa_type',
    ],
    'N-400': [
      'applicant_name',
      'applicant_dob',
      'green_card_number',
      'current_address',
      'date_became_lpr',
    ],
    'G-1145': [
      'applicant_name',
      'email_address',
    ],
  };

  const requiredFields = requiredFieldsByForm[formType] || [];
  const filledFieldNames = currentFields
    .filter((f) => f.suggested_value || f.current_value)
    .map((f) => f.field_name);

  return requiredFields.filter((field) => !filledFieldNames.includes(field));
}

/** Count total fields in a form definition (returns 0 if not found). */
function countFormFields(formType: string): number {
  const def = getFormDefinition(formType);
  if (!def) return 0;
  return def.sections.reduce((sum, s) => sum + s.fields.length, 0);
}

/**
 * Calculate completion percentage for a form
 */
export function calculateFormCompletion(
  formType: string,
  fields: FormField[]
): {
  percentage: number;
  filledCount: number;
  totalRequired: number;
  highConfidenceCount: number;
} {
  // Derive field count from form definitions, with static fallback.
  // countRequiredFields counts only validation.required fields; we use
  // total section field count instead for a more complete denominator.
  let totalRequired = 20;
  const counted = countFormFields(formType);
  if (counted > 0) {
    totalRequired = counted;
  } else {
    const fallback: Record<string, number> = {
      'I-129': 49, 'I-130': 25, 'I-131': 20, 'I-140': 30, 'I-485': 50,
      'I-539': 40, 'I-765': 15, 'I-20': 35, 'DS-160': 60, 'N-400': 40,
      'G-1145': 10,
    };
    totalRequired = fallback[formType] || 20;
  }

  const filledFields = fields.filter(
    (f) => f.suggested_value || f.current_value
  );

  const highConfidenceFields = filledFields.filter(
    (f) => (f.confidence || 0) >= 0.8
  );

  return {
    percentage: Math.min(
      100,
      Math.round((filledFields.length / totalRequired) * 100)
    ),
    filledCount: filledFields.length,
    totalRequired,
    highConfidenceCount: highConfidenceFields.length,
  };
}
