import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  SPECIAL_CHARS_REGEX,
  getPasswordChecks,
  validatePassword,
  isPasswordValid,
  type PasswordChecks,
} from './password';

// A password that satisfies every rule
const VALID_PASSWORD = 'MyPass1!';

describe('password validation', () => {
  describe('constants', () => {
    it('PASSWORD_MIN_LENGTH should be 8', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });

    it('SPECIAL_CHARS_REGEX should match each allowed special character', () => {
      const specials = '!@#$%^&*(),.?":{}|<>';
      for (const ch of specials) {
        expect(SPECIAL_CHARS_REGEX.test(ch)).toBe(true);
      }
    });

    it('SPECIAL_CHARS_REGEX should not match alphanumeric characters', () => {
      expect(SPECIAL_CHARS_REGEX.test('a')).toBe(false);
      expect(SPECIAL_CHARS_REGEX.test('Z')).toBe(false);
      expect(SPECIAL_CHARS_REGEX.test('5')).toBe(false);
    });

    it('SPECIAL_CHARS_REGEX should not match spaces, tabs, or newlines', () => {
      expect(SPECIAL_CHARS_REGEX.test(' ')).toBe(false);
      expect(SPECIAL_CHARS_REGEX.test('\t')).toBe(false);
      expect(SPECIAL_CHARS_REGEX.test('\n')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return null for a valid password', () => {
      expect(validatePassword(VALID_PASSWORD)).toBeNull();
    });

    it('should return null for a long complex password', () => {
      expect(validatePassword('Str0ng&SecureP@ssw0rd!2026')).toBeNull();
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(validatePassword('Ab1!')).toContain('at least 8 characters');
    });

    it('should reject exactly 7-character passwords', () => {
      expect(validatePassword('Abcde1!')).toContain('at least 8 characters');
    });

    it('should accept exactly 8-character passwords that meet all rules', () => {
      expect(validatePassword('Abcdef1!')).toBeNull();
    });

    it('should reject passwords without an uppercase letter', () => {
      expect(validatePassword('mypass1!')).toContain('uppercase letter');
    });

    it('should reject passwords without a lowercase letter', () => {
      expect(validatePassword('MYPASS1!')).toContain('lowercase letter');
    });

    it('should reject passwords without a number', () => {
      expect(validatePassword('MyPassw!')).toContain('one number');
    });

    it('should reject passwords without a special character', () => {
      expect(validatePassword('MyPassw1')).toContain('special character');
    });

    it('should return only the FIRST failing rule (short-circuits)', () => {
      // Empty string fails length first, not uppercase/lowercase/etc.
      const error = validatePassword('');
      expect(error).toContain('at least 8 characters');
    });

    it('should check rules in priority order: length > uppercase > lowercase > number > special', () => {
      // All-lowercase, 8 chars, no number, no special → fails on uppercase (first after length)
      expect(validatePassword('abcdefgh')).toContain('uppercase');

      // Has uppercase but no lowercase → fails on lowercase
      expect(validatePassword('ABCDEFGH')).toContain('lowercase');

      // Has upper + lower but no number → fails on number
      expect(validatePassword('Abcdefgh')).toContain('number');

      // Has upper + lower + number but no special → fails on special
      expect(validatePassword('Abcdefg1')).toContain('special');
    });

    it('should handle empty string', () => {
      expect(validatePassword('')).not.toBeNull();
    });

    it('should handle very long passwords that meet all rules', () => {
      const long = 'Aa1!' + 'x'.repeat(200);
      expect(validatePassword(long)).toBeNull();
    });

    it('should handle passwords with unicode characters', () => {
      // Unicode letters don't count as [A-Z] or [a-z] in regex
      // So a password of only unicode + special + digit should fail uppercase
      expect(validatePassword('ñüéáíóú1!')).toContain('uppercase');
    });

    it('should handle passwords with spaces', () => {
      // Spaces are not special chars per the regex, but the password can contain them
      expect(validatePassword('My Pass1!')).toBeNull();
    });

    it('should accept each special character individually', () => {
      const specials = '!@#$%^&*(),.?":{}|<>';
      for (const ch of specials) {
        const pw = `Abcdefg1${ch}`;
        expect(validatePassword(pw)).toBeNull();
      }
    });
  });

  describe('getPasswordChecks', () => {
    it('should return all true for a valid password', () => {
      const checks = getPasswordChecks(VALID_PASSWORD);
      expect(checks).toEqual({
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true,
        hasSpecial: true,
      });
    });

    it('should return all false for an empty string', () => {
      const checks = getPasswordChecks('');
      expect(checks).toEqual({
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false,
      });
    });

    it('should only flag minLength for a short but otherwise valid password', () => {
      const checks = getPasswordChecks('Ab1!');
      expect(checks.minLength).toBe(false);
      expect(checks.hasUppercase).toBe(true);
      expect(checks.hasLowercase).toBe(true);
      expect(checks.hasNumber).toBe(true);
      expect(checks.hasSpecial).toBe(true);
    });

    it('should detect missing uppercase', () => {
      const checks = getPasswordChecks('mypass1!word');
      expect(checks.hasUppercase).toBe(false);
      expect(checks.hasLowercase).toBe(true);
    });

    it('should detect missing lowercase', () => {
      const checks = getPasswordChecks('MYPASS1!WORD');
      expect(checks.hasLowercase).toBe(false);
      expect(checks.hasUppercase).toBe(true);
    });

    it('should detect missing number', () => {
      const checks = getPasswordChecks('MyPasswd!');
      expect(checks.hasNumber).toBe(false);
    });

    it('should detect missing special character', () => {
      const checks = getPasswordChecks('MyPasswd1');
      expect(checks.hasSpecial).toBe(false);
    });

    it('should report exactly 5 keys matching PasswordChecks interface', () => {
      const checks = getPasswordChecks('anything');
      const keys = Object.keys(checks).sort();
      expect(keys).toEqual([
        'hasLowercase',
        'hasNumber',
        'hasSpecial',
        'hasUppercase',
        'minLength',
      ]);
    });

    it('should be usable with Object.values().every(Boolean) for overall validity', () => {
      expect(Object.values(getPasswordChecks(VALID_PASSWORD)).every(Boolean)).toBe(true);
      expect(Object.values(getPasswordChecks('')).every(Boolean)).toBe(false);
      expect(Object.values(getPasswordChecks('short')).every(Boolean)).toBe(false);
    });
  });

  describe('isPasswordValid', () => {
    it('should return true for a valid password', () => {
      expect(isPasswordValid(VALID_PASSWORD)).toBe(true);
    });

    it('should return false for an empty string', () => {
      expect(isPasswordValid('')).toBe(false);
    });

    it('should return false when any single rule fails', () => {
      expect(isPasswordValid('mypass1!')).toBe(false);   // no uppercase
      expect(isPasswordValid('MYPASS1!')).toBe(false);   // no lowercase
      expect(isPasswordValid('MyPassw!')).toBe(false);   // no number
      expect(isPasswordValid('MyPassw1')).toBe(false);   // no special
      expect(isPasswordValid('Ab1!')).toBe(false);       // too short
    });

    it('should agree with validatePassword — valid iff validatePassword returns null', () => {
      const testCases = [
        VALID_PASSWORD,
        '',
        'short',
        'nouppercase1!',
        'NOLOWERCASE1!',
        'NoNumber!!',
        'NoSpecial1',
        'ValidPass1!',
        'Another$ecure1',
      ];

      for (const pw of testCases) {
        expect(isPasswordValid(pw)).toBe(validatePassword(pw) === null);
      }
    });
  });

  describe('consistency with backend Zod schema', () => {
    // The backend register route (api/auth/register/route.ts) uses:
    //   .min(8)
    //   .regex(/[A-Z]/)
    //   .regex(/[a-z]/)
    //   .regex(/[0-9]/)
    //   .regex(/[!@#$%^&*(),.?":{}|<>]/)
    //
    // These tests verify that our shared module enforces the exact same rules.

    it('should enforce min length of 8 (matching Zod .min(8))', () => {
      expect(validatePassword('Ab1!xyz')).not.toBeNull();   // 7 chars
      expect(validatePassword('Ab1!xyzw')).toBeNull();       // 8 chars
    });

    it('should require uppercase (matching Zod .regex(/[A-Z]/))', () => {
      expect(validatePassword('abcdefg1!')).not.toBeNull();
      expect(validatePassword('Abcdefg1!')).toBeNull();
    });

    it('should require lowercase (matching Zod .regex(/[a-z]/))', () => {
      expect(validatePassword('ABCDEFG1!')).not.toBeNull();
      expect(validatePassword('ABCDEFg1!')).toBeNull();
    });

    it('should require a digit (matching Zod .regex(/[0-9]/))', () => {
      expect(validatePassword('Abcdefgh!')).not.toBeNull();
      expect(validatePassword('Abcdefg1!')).toBeNull();
    });

    it('should require a special char from the exact same set (matching Zod regex)', () => {
      // Characters IN the set should pass
      expect(validatePassword('Abcdefg1!')).toBeNull();
      expect(validatePassword('Abcdefg1@')).toBeNull();
      expect(validatePassword('Abcdefg1<')).toBeNull();

      // Characters NOT in the backend regex should fail
      expect(validatePassword('Abcdefg1~')).not.toBeNull();
      expect(validatePassword('Abcdefg1`')).not.toBeNull();
      expect(validatePassword('Abcdefg1-')).not.toBeNull();
      expect(validatePassword('Abcdefg1_')).not.toBeNull();
      expect(validatePassword('Abcdefg1=')).not.toBeNull();
      expect(validatePassword('Abcdefg1+')).not.toBeNull();
      expect(validatePassword('Abcdefg1[')).not.toBeNull();
      expect(validatePassword('Abcdefg1]')).not.toBeNull();
      expect(validatePassword('Abcdefg1;')).not.toBeNull();
      expect(validatePassword("Abcdefg1'")).not.toBeNull();
      expect(validatePassword('Abcdefg1\\')).not.toBeNull();
      expect(validatePassword('Abcdefg1/')).not.toBeNull();
    });
  });
});
