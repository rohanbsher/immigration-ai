/**
 * Shared password validation rules.
 *
 * Used by: register page, reset-password page, settings page,
 * and the backend register route (via `passwordSchema`).
 */

import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const SPECIAL_CHARS_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

/**
 * Zod schema for password validation — single source of truth.
 * Import this in any route or form that validates passwords.
 */
export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(SPECIAL_CHARS_REGEX, 'Password must contain at least one special character');

export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/**
 * Returns a map of check name to pass/fail for live UI feedback.
 */
export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: SPECIAL_CHARS_REGEX.test(password),
  };
}

/**
 * Returns the first validation error message, or null if the password is valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!SPECIAL_CHARS_REGEX.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

/**
 * Returns true if the password passes all validation rules.
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password) === null;
}
