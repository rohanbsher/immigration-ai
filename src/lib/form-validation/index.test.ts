/**
 * Unit tests for form validation service.
 * Tests AI confidence threshold enforcement and mandatory review fields.
 */

import { describe, test, expect } from 'vitest';
import {
  MIN_CONFIDENCE_THRESHOLD,
  MANDATORY_REVIEW_FIELDS,
  analyzeFormForReview,
  validateFormReadyForFiling,
  createFieldReviewRecord,
  getReviewSummary,
  type FormReviewStatus,
} from './index';
import {
  createFormData,
  createReviewedFieldsData,
} from '@/test-utils/factories';

describe('Form Validation Service', () => {
  describe('MIN_CONFIDENCE_THRESHOLD constant', () => {
    test('should be 0.8', () => {
      expect(MIN_CONFIDENCE_THRESHOLD).toBe(0.8);
    });
  });

  describe('MANDATORY_REVIEW_FIELDS', () => {
    test('should include ssn field', () => {
      expect(MANDATORY_REVIEW_FIELDS).toContain('ssn');
    });

    test('should include alien_number field', () => {
      expect(MANDATORY_REVIEW_FIELDS).toContain('alien_number');
    });

    test('should include passport_number field', () => {
      expect(MANDATORY_REVIEW_FIELDS).toContain('passport_number');
    });
  });

  describe('isMandatoryReviewField (tested via analyzeFormForReview)', () => {
    test('should detect SSN field', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789' };
      const confidenceScores = { ssn: 0.95 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.mandatoryReviewFields).toHaveLength(1);
      expect(result.mandatoryReviewFields[0].fieldName).toBe('ssn');
    });

    test('should detect alien_number field', () => {
      const formData = createFormData();
      const aiFilledData = { alien_number: 'A123456789' };
      const confidenceScores = { alien_number: 0.95 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.mandatoryReviewFields).toHaveLength(1);
      expect(result.mandatoryReviewFields[0].fieldName).toBe('alien_number');
    });

    test('should detect passport_number field', () => {
      const formData = createFormData();
      const aiFilledData = { passport_number: 'AB1234567' };
      const confidenceScores = { passport_number: 0.95 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.mandatoryReviewFields).toHaveLength(1);
      expect(result.mandatoryReviewFields[0].fieldName).toBe('passport_number');
    });

    test('should handle case variations like PassportNumber', () => {
      const formData = createFormData();
      const aiFilledData = { PassportNumber: 'AB1234567' };
      const confidenceScores = { PassportNumber: 0.95 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.mandatoryReviewFields).toHaveLength(1);
      expect(result.mandatoryReviewFields[0].fieldName).toBe('PassportNumber');
    });
  });

  describe('analyzeFormForReview', () => {
    test('should return ready status when no AI data is provided', () => {
      const formData = createFormData();

      const result = analyzeFormForReview(formData, null, null);

      expect(result.canSubmit).toBe(true);
      expect(result.canFile).toBe(true);
      expect(result.lowConfidenceFields).toHaveLength(0);
      expect(result.mandatoryReviewFields).toHaveLength(0);
      expect(result.blockedReasons).toHaveLength(0);
    });

    test('should detect low confidence fields below threshold', () => {
      const formData = createFormData();
      const aiFilledData = { firstName: 'John', lastName: 'Doe' };
      const confidenceScores = { firstName: 0.5, lastName: 0.9 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.lowConfidenceFields).toHaveLength(1);
      expect(result.lowConfidenceFields[0].fieldName).toBe('firstName');
      expect(result.lowConfidenceFields[0].confidence).toBe(0.5);
      expect(result.lowConfidenceFields[0].requiresReview).toBe(true);
    });

    test('should detect mandatory review fields regardless of confidence', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789', firstName: 'John' };
      const confidenceScores = { ssn: 0.99, firstName: 0.95 };

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      expect(result.mandatoryReviewFields).toHaveLength(1);
      expect(result.mandatoryReviewFields[0].fieldName).toBe('ssn');
      expect(result.mandatoryReviewFields[0].reviewReason).toContain('mandatory attorney review');
    });

    test('should track reviewed fields correctly', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789', firstName: 'John' };
      const confidenceScores = { ssn: 0.99, firstName: 0.5 };
      const reviewedFields = createReviewedFieldsData(['ssn', 'firstName']);

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores, reviewedFields);

      expect(result.mandatoryReviewFields[0].reviewed).toBe(true);
      expect(result.lowConfidenceFields[0].reviewed).toBe(true);
      expect(result.reviewedFields).toBe(2);
    });

    test('should calculate pending review count correctly', () => {
      const formData = createFormData();
      const aiFilledData = {
        ssn: '123-45-6789',
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St',
      };
      const confidenceScores = {
        ssn: 0.99,
        firstName: 0.5,
        lastName: 0.6,
        address: 0.95,
      };
      const reviewedFields = createReviewedFieldsData(['firstName']);

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores, reviewedFields);

      // ssn (mandatory, not reviewed) + lastName (low conf, not reviewed) = 2 pending
      expect(result.pendingReviewFields).toBe(2);
    });

    test('should set canSubmit to true when all mandatory fields are reviewed', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789', firstName: 'John' };
      const confidenceScores = { ssn: 0.99, firstName: 0.5 };
      const reviewedFields = createReviewedFieldsData(['ssn']);

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores, reviewedFields);

      expect(result.canSubmit).toBe(true);
      // canFile should still be false because firstName has low confidence and not reviewed
      expect(result.canFile).toBe(false);
    });

    test('should set canFile to true only when all pending reviews are complete', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789', firstName: 'John' };
      const confidenceScores = { ssn: 0.99, firstName: 0.5 };
      const reviewedFields = createReviewedFieldsData(['ssn', 'firstName']);

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores, reviewedFields);

      expect(result.canSubmit).toBe(true);
      expect(result.canFile).toBe(true);
      expect(result.pendingReviewFields).toBe(0);
    });
  });

  describe('validateFormReadyForFiling', () => {
    test('should return ready when all reviews are complete', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789' };
      const confidenceScores = { ssn: 0.99 };
      const reviewedFields = createReviewedFieldsData(['ssn']);

      const result = validateFormReadyForFiling(
        formData,
        aiFilledData,
        confidenceScores,
        reviewedFields
      );

      expect(result.isReady).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return errors for pending mandatory reviews', () => {
      const formData = createFormData();
      const aiFilledData = { ssn: '123-45-6789' };
      const confidenceScores = { ssn: 0.99 };

      const result = validateFormReadyForFiling(formData, aiFilledData, confidenceScores, null);

      expect(result.isReady).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('ssn');
    });
  });

  describe('createFieldReviewRecord', () => {
    test('should create correct structure with all required fields', () => {
      const record = createFieldReviewRecord(
        'ssn',
        '123-45-6789',
        '123-45-6789',
        'attorney@test.com'
      );

      expect(record).toHaveProperty('ssn');
      expect(record.ssn.original_value).toBe('123-45-6789');
      expect(record.ssn.accepted_value).toBe('123-45-6789');
      expect(record.ssn.reviewed_by).toBe('attorney@test.com');
    });

    test('should include timestamp in ISO format', () => {
      const before = new Date().toISOString();
      const record = createFieldReviewRecord('ssn', 'old', 'new', 'reviewer');
      const after = new Date().toISOString();

      expect(record.ssn.reviewed_at).toBeDefined();
      // Timestamp should be between before and after
      expect(record.ssn.reviewed_at >= before).toBe(true);
      expect(record.ssn.reviewed_at <= after).toBe(true);
    });
  });

  describe('getReviewSummary', () => {
    test('should return ready message when form can be filed', () => {
      const reviewStatus: FormReviewStatus = {
        formId: 'test',
        formType: 'I-130',
        totalFields: 10,
        reviewedFields: 2,
        pendingReviewFields: 0,
        lowConfidenceFields: [],
        mandatoryReviewFields: [],
        canSubmit: true,
        canFile: true,
        blockedReasons: [],
      };

      const summary = getReviewSummary(reviewStatus);

      expect(summary).toBe('All fields reviewed. Form is ready for filing.');
    });

    test('should list pending mandatory fields in summary', () => {
      const reviewStatus: FormReviewStatus = {
        formId: 'test',
        formType: 'I-130',
        totalFields: 10,
        reviewedFields: 0,
        pendingReviewFields: 1,
        lowConfidenceFields: [],
        mandatoryReviewFields: [
          {
            fieldName: 'ssn',
            aiValue: '123-45-6789',
            confidence: 0.99,
            requiresReview: true,
            reviewReason: 'Sensitive field requires mandatory attorney review',
            reviewed: false,
          },
        ],
        canSubmit: false,
        canFile: false,
        blockedReasons: ['Sensitive field "ssn" requires attorney review'],
      };

      const summary = getReviewSummary(reviewStatus);

      expect(summary).toContain('1 sensitive field(s) require mandatory review');
    });

    test('should list pending low confidence fields in summary', () => {
      const reviewStatus: FormReviewStatus = {
        formId: 'test',
        formType: 'I-130',
        totalFields: 10,
        reviewedFields: 0,
        pendingReviewFields: 2,
        lowConfidenceFields: [
          {
            fieldName: 'firstName',
            aiValue: 'John',
            confidence: 0.5,
            requiresReview: true,
            reviewReason: 'AI confidence (50%) below threshold (80%)',
            reviewed: false,
          },
          {
            fieldName: 'lastName',
            aiValue: 'Doe',
            confidence: 0.6,
            requiresReview: true,
            reviewReason: 'AI confidence (60%) below threshold (80%)',
            reviewed: false,
          },
        ],
        mandatoryReviewFields: [],
        canSubmit: true,
        canFile: false,
        blockedReasons: [],
      };

      const summary = getReviewSummary(reviewStatus);

      expect(summary).toContain('2 field(s) have low AI confidence and need review');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty form data', () => {
      const result = analyzeFormForReview({}, null, null);

      expect(result.totalFields).toBe(0);
      expect(result.canSubmit).toBe(true);
      expect(result.canFile).toBe(true);
    });

    test('should handle AI data with missing confidence scores', () => {
      const formData = createFormData();
      const aiFilledData = { firstName: 'John', lastName: 'Doe' };
      const confidenceScores = { firstName: 0.95 }; // lastName missing

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      // lastName should default to 0 confidence (below threshold)
      expect(result.lowConfidenceFields.some(f => f.fieldName === 'lastName')).toBe(true);
    });

    test('should handle field at exact threshold value', () => {
      const formData = createFormData();
      const aiFilledData = { firstName: 'John' };
      const confidenceScores = { firstName: 0.8 }; // Exactly at threshold

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      // At threshold should NOT be flagged as low confidence (0.8 >= 0.8)
      expect(result.lowConfidenceFields).toHaveLength(0);
    });

    test('should handle field just below threshold', () => {
      const formData = createFormData();
      const aiFilledData = { firstName: 'John' };
      const confidenceScores = { firstName: 0.79 }; // Just below threshold

      const result = analyzeFormForReview(formData, aiFilledData, confidenceScores);

      // Below threshold should be flagged
      expect(result.lowConfidenceFields).toHaveLength(1);
    });
  });
});
