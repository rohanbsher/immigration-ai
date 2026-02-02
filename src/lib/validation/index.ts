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
};

const validationUtils = {
  formatZodError,
  validate,
  validateRequestBody,
  validateSearchParams,
  schemas,
};

export default validationUtils;
