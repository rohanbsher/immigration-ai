/**
 * Validation utilities for consistent error handling and formatting.
 *
 * @example
 * ```typescript
 * import { formatZodError, validateRequestBody } from '@/lib/validation';
 *
 * const schema = z.object({ name: z.string().min(1) });
 * const result = await validateRequestBody(request, schema);
 *
 * if (!result.success) {
 *   return errorResponse(result.error.message, 400, { fields: result.error.fieldErrors });
 * }
 *
 * const { name } = result.data;
 * ```
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';

export interface ValidationError {
  message: string;
  fieldErrors: Record<string, string[]>;
}

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: ValidationError;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Format a Zod error into a structured validation error.
 */
export function formatZodError(error: z.ZodError): ValidationError {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';

    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }

  // Create a summary message
  const firstError = error.issues[0];
  const message = firstError
    ? `${firstError.path.join('.') || 'Input'}: ${firstError.message}`
    : 'Validation failed';

  return {
    message,
    fieldErrors,
  };
}

/**
 * Validate data against a Zod schema.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: formatZodError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Parse and validate JSON request body against a Zod schema.
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    return validate(schema, body);
  } catch {
    return {
      success: false,
      error: {
        message: 'Invalid JSON in request body',
        fieldErrors: { _root: ['Request body must be valid JSON'] },
      },
    };
  }
}

/**
 * Validate URL search params against a Zod schema.
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  // Convert URLSearchParams to a plain object
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  return validate(schema, params);
}

/**
 * Enum values matching database schema and TypeScript types.
 * These are the single source of truth for API validation.
 */
export const VISA_TYPES = [
  'B1B2', 'F1', 'H1B', 'H4', 'L1', 'O1',
  'EB1', 'EB2', 'EB3', 'EB5',
  'I-130', 'I-485', 'I-765', 'I-131', 'N-400',
  'other',
] as const;

export const CASE_STATUSES = [
  'intake', 'document_collection', 'in_review', 'forms_preparation',
  'ready_for_filing', 'filed', 'pending_response',
  'approved', 'denied', 'closed',
] as const;

export const DOCUMENT_TYPES = [
  'passport', 'visa', 'i94', 'birth_certificate', 'marriage_certificate',
  'divorce_certificate', 'employment_letter', 'pay_stub', 'tax_return',
  'w2', 'bank_statement', 'photo', 'medical_exam', 'police_clearance',
  'diploma', 'transcript', 'recommendation_letter', 'other',
] as const;

export const DOCUMENT_STATUSES = [
  'uploaded', 'processing', 'analyzed', 'needs_review',
  'verified', 'rejected', 'expired',
] as const;

export const FORM_TYPES = [
  'I-130', 'I-485', 'I-765', 'I-131', 'I-140',
  'I-129', 'I-539', 'I-20', 'DS-160', 'N-400', 'G-1145',
] as const;

export const FORM_STATUSES = [
  'draft', 'autofilling', 'ai_filled', 'in_review',
  'needs_review', 'approved', 'filed', 'rejected',
] as const;

export type FormStatusType = typeof FORM_STATUSES[number];

/**
 * Valid form status transitions.
 * Key = current status, Value = allowed next statuses.
 * Prevents invalid transitions like filed->draft.
 */
export const VALID_FORM_TRANSITIONS: Record<FormStatusType, readonly FormStatusType[]> = {
  draft: ['autofilling', 'in_review'],
  autofilling: ['ai_filled', 'draft'],        // draft = reset on failure
  ai_filled: ['in_review', 'needs_review', 'draft'], // needs_review = source doc deleted
  in_review: ['approved', 'rejected', 'needs_review', 'draft'], // draft = back to editing
  needs_review: ['in_review', 'draft'],        // needs_review = flagged for re-review
  approved: ['filed', 'in_review'],            // in_review = re-review
  filed: [],                                    // terminal state
  rejected: ['draft', 'in_review'],            // draft = start over
} as const;

/**
 * Check if a form status transition is valid.
 */
export function isValidFormTransition(from: FormStatusType, to: FormStatusType): boolean {
  if (from === to) return true; // No-op is always valid
  const allowed = VALID_FORM_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Common validation schemas for reuse.
 */
export const schemas = {
  /** UUID validation */
  uuid: z.string().uuid('Invalid ID format'),

  /** Email validation */
  email: z.string().email('Invalid email address'),

  /** Pagination parameters */
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  /** Date string validation */
  dateString: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Invalid date format'
  ),

  /** Non-empty string */
  nonEmptyString: z.string().min(1, 'This field is required'),

  /** Enum schemas for domain types */
  visaType: z.enum(VISA_TYPES),
  caseStatus: z.enum(CASE_STATUSES),
  documentType: z.enum(DOCUMENT_TYPES),
  documentStatus: z.enum(DOCUMENT_STATUSES),
  formType: z.enum(FORM_TYPES),
  formStatus: z.enum(FORM_STATUSES),
};

const validationUtils = {
  formatZodError,
  validate,
  validateRequestBody,
  validateSearchParams,
  schemas,
};

export default validationUtils;
