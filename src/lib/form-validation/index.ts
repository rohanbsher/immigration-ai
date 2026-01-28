/**
 * Form validation service for AI confidence threshold enforcement.
 *
 * Critical for immigration cases: ensures AI-filled data with low confidence
 * is reviewed by an attorney before form submission or filing.
 */

// Minimum confidence threshold for AI-filled fields
export const MIN_CONFIDENCE_THRESHOLD = 0.8;

// Fields that always require attorney review regardless of confidence
export const MANDATORY_REVIEW_FIELDS = [
  'ssn',
  'social_security_number',
  'alien_number',
  'a_number',
  'passport_number',
  'visa_number',
  'green_card_number',
  'i94_number',
  'employment_authorization_number',
  'receipt_number',
];

export interface FieldReviewStatus {
  fieldName: string;
  aiValue: unknown;
  confidence: number;
  requiresReview: boolean;
  reviewReason: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  originalValue?: unknown;
  modifiedValue?: unknown;
}

export interface FormReviewStatus {
  formId: string;
  formType: string;
  totalFields: number;
  reviewedFields: number;
  pendingReviewFields: number;
  lowConfidenceFields: FieldReviewStatus[];
  mandatoryReviewFields: FieldReviewStatus[];
  canSubmit: boolean;
  canFile: boolean;
  blockedReasons: string[];
}

export interface ReviewedFieldsData {
  reviewed_fields: Record<string, {
    reviewed_at: string;
    reviewed_by: string;
    original_value: unknown;
    accepted_value: unknown;
  }>;
}

/**
 * Check if a field name is a mandatory review field
 */
function isMandatoryReviewField(fieldName: string): boolean {
  const normalizedName = fieldName.toLowerCase().replace(/[_\s-]/g, '');
  return MANDATORY_REVIEW_FIELDS.some(field =>
    normalizedName.includes(field.toLowerCase().replace(/[_\s-]/g, ''))
  );
}

/**
 * Analyze form data and determine which fields require review
 */
export function analyzeFormForReview(
  formData: Record<string, unknown>,
  aiFilledData: Record<string, unknown> | null,
  aiConfidenceScores: Record<string, number> | null,
  reviewedFieldsData?: ReviewedFieldsData | null
): FormReviewStatus {
  const reviewedFields = reviewedFieldsData?.reviewed_fields || {};
  const lowConfidenceFields: FieldReviewStatus[] = [];
  const mandatoryReviewFields: FieldReviewStatus[] = [];
  const blockedReasons: string[] = [];

  // If no AI data, nothing to review
  if (!aiFilledData || !aiConfidenceScores) {
    return {
      formId: '',
      formType: '',
      totalFields: Object.keys(formData).length,
      reviewedFields: 0,
      pendingReviewFields: 0,
      lowConfidenceFields: [],
      mandatoryReviewFields: [],
      canSubmit: true,
      canFile: true,
      blockedReasons: [],
    };
  }

  // Check each AI-filled field
  for (const [fieldName, aiValue] of Object.entries(aiFilledData)) {
    const confidence = aiConfidenceScores[fieldName] ?? 0;
    const isReviewed = fieldName in reviewedFields;
    const isMandatory = isMandatoryReviewField(fieldName);
    const isLowConfidence = confidence < MIN_CONFIDENCE_THRESHOLD;

    if (isMandatory) {
      const fieldStatus: FieldReviewStatus = {
        fieldName,
        aiValue,
        confidence,
        requiresReview: true,
        reviewReason: 'Sensitive field requires mandatory attorney review',
        reviewed: isReviewed,
        reviewedAt: reviewedFields[fieldName]?.reviewed_at,
        reviewedBy: reviewedFields[fieldName]?.reviewed_by,
        originalValue: reviewedFields[fieldName]?.original_value,
        modifiedValue: reviewedFields[fieldName]?.accepted_value,
      };

      mandatoryReviewFields.push(fieldStatus);

      if (!isReviewed) {
        blockedReasons.push(`Sensitive field "${fieldName}" requires attorney review`);
      }
    } else if (isLowConfidence) {
      const fieldStatus: FieldReviewStatus = {
        fieldName,
        aiValue,
        confidence,
        requiresReview: true,
        reviewReason: `AI confidence (${(confidence * 100).toFixed(0)}%) below threshold (${MIN_CONFIDENCE_THRESHOLD * 100}%)`,
        reviewed: isReviewed,
        reviewedAt: reviewedFields[fieldName]?.reviewed_at,
        reviewedBy: reviewedFields[fieldName]?.reviewed_by,
        originalValue: reviewedFields[fieldName]?.original_value,
        modifiedValue: reviewedFields[fieldName]?.accepted_value,
      };

      lowConfidenceFields.push(fieldStatus);

      if (!isReviewed) {
        blockedReasons.push(`Field "${fieldName}" has low AI confidence (${(confidence * 100).toFixed(0)}%) and requires review`);
      }
    }
  }

  const unreviewedLowConfidence = lowConfidenceFields.filter(f => !f.reviewed);
  const unreviewedMandatory = mandatoryReviewFields.filter(f => !f.reviewed);
  const totalPendingReview = unreviewedLowConfidence.length + unreviewedMandatory.length;

  return {
    formId: '',
    formType: '',
    totalFields: Object.keys(formData).length,
    reviewedFields: lowConfidenceFields.filter(f => f.reviewed).length +
                    mandatoryReviewFields.filter(f => f.reviewed).length,
    pendingReviewFields: totalPendingReview,
    lowConfidenceFields,
    mandatoryReviewFields,
    canSubmit: unreviewedMandatory.length === 0, // Can submit if mandatory fields are reviewed
    canFile: totalPendingReview === 0, // Can only file if ALL pending reviews are complete
    blockedReasons,
  };
}

/**
 * Validate that a form is ready for filing (all reviews complete)
 */
export function validateFormReadyForFiling(
  formData: Record<string, unknown>,
  aiFilledData: Record<string, unknown> | null,
  aiConfidenceScores: Record<string, number> | null,
  reviewedFieldsData?: ReviewedFieldsData | null
): { isReady: boolean; errors: string[] } {
  const reviewStatus = analyzeFormForReview(
    formData,
    aiFilledData,
    aiConfidenceScores,
    reviewedFieldsData
  );

  if (reviewStatus.canFile) {
    return { isReady: true, errors: [] };
  }

  return {
    isReady: false,
    errors: reviewStatus.blockedReasons,
  };
}

/**
 * Mark fields as reviewed by attorney
 */
export function createFieldReviewRecord(
  fieldName: string,
  originalValue: unknown,
  acceptedValue: unknown,
  reviewedBy: string
): Record<string, {
  reviewed_at: string;
  reviewed_by: string;
  original_value: unknown;
  accepted_value: unknown;
}> {
  return {
    [fieldName]: {
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      original_value: originalValue,
      accepted_value: acceptedValue,
    },
  };
}

/**
 * Get summary of fields requiring review for a form
 */
export function getReviewSummary(reviewStatus: FormReviewStatus): string {
  if (reviewStatus.canFile) {
    return 'All fields reviewed. Form is ready for filing.';
  }

  const parts: string[] = [];

  const unreviewedMandatory = reviewStatus.mandatoryReviewFields.filter(f => !f.reviewed);
  if (unreviewedMandatory.length > 0) {
    parts.push(`${unreviewedMandatory.length} sensitive field(s) require mandatory review`);
  }

  const unreviewedLowConf = reviewStatus.lowConfidenceFields.filter(f => !f.reviewed);
  if (unreviewedLowConf.length > 0) {
    parts.push(`${unreviewedLowConf.length} field(s) have low AI confidence and need review`);
  }

  return parts.join('. ') + '.';
}
