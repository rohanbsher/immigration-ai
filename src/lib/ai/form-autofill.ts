// Form auto-fill service using Claude for reasoning

import {
  generateFormAutofill,
  validateFormData,
  analyzeDataConsistency,
} from './anthropic';
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
  visaType?: string
): string[] {
  const baseDocuments: Record<string, string[]> = {
    'I-130': [
      'Petitioner passport or birth certificate',
      'Petitioner proof of status (passport, naturalization certificate, or green card)',
      'Beneficiary passport',
      'Beneficiary birth certificate',
      'Marriage certificate (if filing for spouse)',
      'Proof of relationship',
    ],
    'I-485': [
      'Passport',
      'Birth certificate',
      'I-94 arrival/departure record',
      'Passport-style photos',
      'Medical examination (I-693)',
      'Affidavit of support (I-864)',
      'Evidence of lawful entry',
    ],
    'I-765': [
      'Passport',
      'I-94 arrival/departure record',
      'Passport-style photos',
      'Evidence of eligibility category',
    ],
    'N-400': [
      'Green card (front and back)',
      'Passport',
      'Tax returns (5 years)',
      'Travel history documentation',
      'Marriage/divorce certificates',
      'Birth certificates of children',
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
  // Field mapping definitions
  const fieldMappings: Record<string, Record<string, string>> = {
    'I-130': {
      full_name: 'pt2_legal_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
      place_of_birth: 'pt2_pob_city',
      nationality: 'pt2_country_of_birth',
      passport_number: 'pt2_passport_number',
    },
    'I-485': {
      full_name: 'pt1_current_name',
      given_name: 'pt1_given_name',
      surname: 'pt1_family_name',
      date_of_birth: 'pt1_dob',
      place_of_birth: 'pt1_pob',
      nationality: 'pt1_country_of_birth',
    },
    'I-765': {
      full_name: 'pt2_legal_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
    },
    'N-400': {
      full_name: 'pt2_current_name',
      given_name: 'pt2_given_name',
      surname: 'pt2_family_name',
      date_of_birth: 'pt2_dob',
      place_of_birth: 'pt2_pob',
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
    'I-130': [
      'petitioner_name',
      'petitioner_dob',
      'petitioner_address',
      'beneficiary_name',
      'beneficiary_dob',
      'relationship',
    ],
    'I-485': [
      'applicant_name',
      'applicant_dob',
      'applicant_address',
      'country_of_birth',
      'date_of_entry',
    ],
    'I-765': [
      'applicant_name',
      'applicant_dob',
      'eligibility_category',
    ],
    'N-400': [
      'applicant_name',
      'applicant_dob',
      'green_card_number',
      'current_address',
      'date_became_lpr',
    ],
  };

  const requiredFields = requiredFieldsByForm[formType] || [];
  const filledFieldNames = currentFields
    .filter((f) => f.suggested_value || f.current_value)
    .map((f) => f.field_name);

  return requiredFields.filter((field) => !filledFieldNames.includes(field));
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
  const requiredFieldsByForm: Record<string, number> = {
    'I-130': 25,
    'I-485': 50,
    'I-765': 15,
    'N-400': 40,
  };

  const totalRequired = requiredFieldsByForm[formType] || 20;

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
