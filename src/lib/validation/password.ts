/**
 * Shared password validation rules.
 *
 * Used by: register page, reset-password page, settings page.
 * The backend register route (`api/auth/register/route.ts`) has its own
 * Zod schema with identical rules as a server-side guard.
 *
 * If you change rules here, update the Zod schema in the register route too.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const SPECIAL_CHARS_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

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
