import {
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodes,
  verifyBackupCode,
  formatBackupCode,
  parseBackupCode,
} from '@/lib/2fa/backup-codes';

describe('Backup Codes', () => {
  describe('generateBackupCodes', () => {
    it('should generate 10 codes by default', () => {
      const codes = generateBackupCodes();
      expect(codes).toHaveLength(10);
    });

    it('should generate specified number of codes', () => {
      const codes = generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });

    it('should generate 8-character uppercase hex codes', () => {
      const codes = generateBackupCodes();
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-F0-9]{8}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes(100);
      const uniqueCodes = new Set(codes);
      // Very unlikely to have duplicates with crypto random
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('hashBackupCode', () => {
    it('should return a SHA-256 hash (64 chars hex)', () => {
      const code = 'ABCD1234';
      const hash = hashBackupCode(code);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be case-insensitive', () => {
      const hash1 = hashBackupCode('ABCD1234');
      const hash2 = hashBackupCode('abcd1234');
      expect(hash1).toBe(hash2);
    });

    it('should strip non-alphanumeric characters', () => {
      const hash1 = hashBackupCode('ABCD1234');
      const hash2 = hashBackupCode('ABCD-1234');
      expect(hash1).toBe(hash2);
    });

    it('should produce consistent hashes', () => {
      const code = 'TEST1234';
      const hash1 = hashBackupCode(code);
      const hash2 = hashBackupCode(code);
      expect(hash1).toBe(hash2);
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash all codes in array', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashes = hashBackupCodes(codes);
      expect(hashes).toHaveLength(2);
      expect(hashes[0]).toBe(hashBackupCode('ABCD1234'));
      expect(hashes[1]).toBe(hashBackupCode('EFGH5678'));
    });

    it('should handle empty array', () => {
      const hashes = hashBackupCodes([]);
      expect(hashes).toEqual([]);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid code against hashed codes', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashedCodes = hashBackupCodes(codes);

      expect(verifyBackupCode('ABCD1234', hashedCodes)).toBe(true);
      expect(verifyBackupCode('EFGH5678', hashedCodes)).toBe(true);
    });

    it('should reject invalid code', () => {
      const codes = ['ABCD1234'];
      const hashedCodes = hashBackupCodes(codes);

      expect(verifyBackupCode('INVALID1', hashedCodes)).toBe(false);
    });

    it('should verify case-insensitively', () => {
      const codes = ['ABCD1234'];
      const hashedCodes = hashBackupCodes(codes);

      expect(verifyBackupCode('abcd1234', hashedCodes)).toBe(true);
    });

    it('should verify with dashes in code', () => {
      const codes = ['ABCD1234'];
      const hashedCodes = hashBackupCodes(codes);

      expect(verifyBackupCode('ABCD-1234', hashedCodes)).toBe(true);
    });
  });

  describe('formatBackupCode', () => {
    it('should format code with dash in middle', () => {
      expect(formatBackupCode('ABCD1234')).toBe('ABCD-1234');
    });

    it('should work with 8-character codes', () => {
      expect(formatBackupCode('12345678')).toBe('1234-5678');
    });
  });

  describe('parseBackupCode', () => {
    it('should remove dashes and uppercase', () => {
      expect(parseBackupCode('ABCD-1234')).toBe('ABCD1234');
    });

    it('should handle lowercase input', () => {
      expect(parseBackupCode('abcd-1234')).toBe('ABCD1234');
    });

    it('should handle code without dash', () => {
      expect(parseBackupCode('abcd1234')).toBe('ABCD1234');
    });

    it('should handle multiple dashes', () => {
      expect(parseBackupCode('AB-CD-12-34')).toBe('ABCD1234');
    });
  });

  describe('Integration: generate, hash, verify flow', () => {
    it('should verify generated codes after hashing', () => {
      const codes = generateBackupCodes(5);
      const hashedCodes = hashBackupCodes(codes);

      // Each original code should verify
      codes.forEach((code) => {
        expect(verifyBackupCode(code, hashedCodes)).toBe(true);
      });
    });

    it('should verify formatted codes', () => {
      const codes = generateBackupCodes(3);
      const hashedCodes = hashBackupCodes(codes);

      // Format and verify
      codes.forEach((code) => {
        const formatted = formatBackupCode(code);
        expect(verifyBackupCode(formatted, hashedCodes)).toBe(true);
      });
    });
  });
});
