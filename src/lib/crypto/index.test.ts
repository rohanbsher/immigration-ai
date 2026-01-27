import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptIfNeeded,
  decryptIfNeeded,
  isSensitiveField,
  encryptSensitiveFields,
  decryptSensitiveFields,
  maskSensitiveValue,
  SENSITIVE_FIELDS,
  type EncryptedData,
} from './index';

describe('crypto utilities', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should return different encrypted values for same plaintext', () => {
      const plaintext = 'Same text';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.data).not.toBe(encrypted2.data);
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should include version number in encrypted data', () => {
      const encrypted = encrypt('test');
      expect(encrypted.v).toBe(1);
    });

    it('should reject unsupported encryption versions', () => {
      const encrypted = encrypt('test');
      encrypted.v = 99;

      expect(() => decrypt(encrypted)).toThrow('Unsupported encryption version');
    });

    it('should fail decryption with tampered data', () => {
      const encrypted = encrypt('test');
      encrypted.data = 'tampered' + encrypted.data;

      expect(() => decrypt(encrypted)).toThrow();
    });

    it('should fail decryption with wrong auth tag', () => {
      const encrypted = encrypt('test');
      encrypted.tag = '0'.repeat(32);

      expect(() => decrypt(encrypted)).toThrow();
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted data', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain strings', () => {
      expect(isEncrypted('plain string')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isEncrypted(null)).toBe(false);
    });

    it('should return false for incomplete objects', () => {
      expect(isEncrypted({ iv: 'abc' })).toBe(false);
      expect(isEncrypted({ iv: 'abc', data: 'def' })).toBe(false);
      expect(isEncrypted({ iv: 'abc', data: 'def', tag: 'ghi' })).toBe(false);
    });

    it('should return true for objects with correct structure', () => {
      const obj = { iv: 'abc', data: 'def', tag: 'ghi', v: 1 };
      expect(isEncrypted(obj)).toBe(true);
    });
  });

  describe('encryptIfNeeded', () => {
    it('should encrypt plain strings', () => {
      const result = encryptIfNeeded('plain text');
      expect(isEncrypted(result)).toBe(true);
    });

    it('should return already encrypted data unchanged', () => {
      const encrypted = encrypt('test');
      const result = encryptIfNeeded(encrypted);

      expect(result).toEqual(encrypted);
    });
  });

  describe('decryptIfNeeded', () => {
    it('should decrypt encrypted data', () => {
      const encrypted = encrypt('secret');
      const result = decryptIfNeeded(encrypted);

      expect(result).toBe('secret');
    });

    it('should return plain strings unchanged', () => {
      const result = decryptIfNeeded('plain text');
      expect(result).toBe('plain text');
    });
  });

  describe('isSensitiveField', () => {
    it('should identify passport_number as sensitive', () => {
      expect(isSensitiveField('passport_number')).toBe(true);
    });

    it('should identify ssn as sensitive', () => {
      expect(isSensitiveField('ssn')).toBe(true);
      expect(isSensitiveField('SSN')).toBe(true);
    });

    it('should identify date_of_birth as sensitive', () => {
      expect(isSensitiveField('date_of_birth')).toBe(true);
      expect(isSensitiveField('dateOfBirth')).toBe(true);
    });

    it('should identify alien_number as sensitive', () => {
      expect(isSensitiveField('alien_number')).toBe(true);
    });

    it('should not identify regular fields as sensitive', () => {
      expect(isSensitiveField('name')).toBe(false);
      expect(isSensitiveField('email')).toBe(false);
      expect(isSensitiveField('address')).toBe(false);
    });

    it('should handle field names with different separators', () => {
      expect(isSensitiveField('social-security-number')).toBe(true);
      expect(isSensitiveField('socialSecurityNumber')).toBe(true);
    });
  });

  describe('encryptSensitiveFields', () => {
    it('should encrypt sensitive fields only', () => {
      const data = {
        name: 'John Doe',
        passport_number: 'AB123456',
        email: 'john@example.com',
      };

      const result = encryptSensitiveFields(data);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(isEncrypted(result.passport_number)).toBe(true);
    });

    it('should handle nested objects', () => {
      const data = {
        client: {
          name: 'Jane',
          ssn: '123-45-6789',
        },
      };

      const result = encryptSensitiveFields(data);

      expect(result.client.name).toBe('Jane');
      expect(isEncrypted(result.client.ssn)).toBe(true);
    });

    it('should not encrypt non-string values', () => {
      const data = {
        count: 42,
        passport_number: 123456, // number, not string
      };

      const result = encryptSensitiveFields(data);

      expect(result.count).toBe(42);
      expect(result.passport_number).toBe(123456);
    });

    it('should handle arrays correctly (not encrypt)', () => {
      const data = {
        tags: ['a', 'b', 'c'],
        ssn: '123-45-6789',
      };

      const result = encryptSensitiveFields(data);

      expect(result.tags).toEqual(['a', 'b', 'c']);
      expect(isEncrypted(result.ssn)).toBe(true);
    });
  });

  describe('decryptSensitiveFields', () => {
    it('should decrypt encrypted fields', () => {
      const original = {
        name: 'John Doe',
        passport_number: 'AB123456',
      };

      const encrypted = encryptSensitiveFields(original);
      const decrypted = decryptSensitiveFields(encrypted);

      expect(decrypted.name).toBe('John Doe');
      expect(decrypted.passport_number).toBe('AB123456');
    });

    it('should handle nested encrypted objects', () => {
      const original = {
        client: {
          name: 'Jane',
          ssn: '123-45-6789',
        },
      };

      const encrypted = encryptSensitiveFields(original);
      const decrypted = decryptSensitiveFields(encrypted);

      expect(decrypted.client.name).toBe('Jane');
      expect(decrypted.client.ssn).toBe('123-45-6789');
    });

    it('should leave plain values unchanged', () => {
      const data = {
        name: 'Test',
        count: 42,
      };

      const result = decryptSensitiveFields(data);

      expect(result).toEqual(data);
    });
  });

  describe('maskSensitiveValue', () => {
    it('should mask all but last 4 characters', () => {
      expect(maskSensitiveValue('1234567890')).toBe('******7890');
    });

    it('should mask short values completely', () => {
      expect(maskSensitiveValue('123')).toBe('***');
      expect(maskSensitiveValue('1234')).toBe('****');
    });

    it('should handle exactly 5 character values', () => {
      expect(maskSensitiveValue('12345')).toBe('*2345');
    });

    it('should handle empty strings', () => {
      expect(maskSensitiveValue('')).toBe('');
    });
  });

  describe('SENSITIVE_FIELDS constant', () => {
    it('should include expected fields', () => {
      expect(SENSITIVE_FIELDS).toContain('passport_number');
      expect(SENSITIVE_FIELDS).toContain('ssn');
      expect(SENSITIVE_FIELDS).toContain('social_security_number');
      expect(SENSITIVE_FIELDS).toContain('date_of_birth');
      expect(SENSITIVE_FIELDS).toContain('alien_number');
      expect(SENSITIVE_FIELDS).toContain('tax_id');
    });
  });
});
