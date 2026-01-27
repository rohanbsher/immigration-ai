import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ============================================================================
// Hoisted Mock Variables
// ============================================================================
const {
  mockValidate,
  mockGenerate,
  mockToString,
  mockToDataURL,
  mockQRToString,
  mockSupabaseFrom,
  mockSupabaseRpc,
  mockEncrypt,
  mockDecrypt,
} = vi.hoisted(() => ({
  mockValidate: vi.fn().mockReturnValue(0),
  mockGenerate: vi.fn().mockReturnValue('123456'),
  mockToString: vi.fn().mockReturnValue('otpauth://totp/Immigration%20AI:test@example.com?secret=TEST'),
  mockToDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCodeData'),
  mockQRToString: vi.fn().mockResolvedValue('<svg>mock SVG content</svg>'),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseRpc: vi.fn().mockResolvedValue({ data: 0 }),
  mockEncrypt: vi.fn().mockReturnValue({
    iv: 'mockIv',
    data: 'mockEncryptedData',
    tag: 'mockTag',
    v: 1,
  }),
  mockDecrypt: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP12345678'),
}));

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('otpauth', () => {
  class MockTOTP {
    validate = mockValidate;
    generate = mockGenerate;
    toString = mockToString;
  }
  return {
    TOTP: MockTOTP,
    Secret: {
      fromBase32: vi.fn().mockImplementation((secret: string) => ({ base32: secret })),
    },
  };
});

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mockToDataURL,
    toString: mockQRToString,
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  }),
}));

vi.mock('@/lib/crypto', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  generateSecret,
  verifyTOTP,
  getKeyUri,
  generateQRCodeDataURL,
  generateQRCodeSVG,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  formatBackupCode,
  parseBackupCode,
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyTwoFactorToken,
  disableTwoFactor,
  regenerateBackupCodes,
  getTwoFactorStatus,
  isTwoFactorRequired,
} from './index';

import { generateTOTP, getRemainingSeconds } from './totp';
import { hashBackupCode } from './backup-codes';

// ============================================================================
// Helper to create chainable Supabase mock
// ============================================================================
function createSupabaseMockChain(options: {
  selectData?: unknown;
  selectError?: { message: string } | null;
  insertError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
  countResult?: number;
}) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: options.selectData ?? null,
    error: options.selectError ?? null,
  });

  const mockEq = vi.fn().mockImplementation(() => ({
    eq: mockEq,
    single: mockSingle,
    error: null,
  }));

  const mockSelect = vi.fn().mockImplementation((_fields, opts) => {
    if (opts?.count === 'exact') {
      return {
        eq: vi.fn().mockResolvedValue({ count: options.countResult ?? 0 }),
      };
    }
    return { eq: mockEq };
  });

  const mockInsert = vi.fn().mockReturnValue({
    error: options.insertError ?? null,
  });

  const mockUpdate = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      error: options.updateError ?? null,
    }),
  }));

  const mockDelete = vi.fn().mockImplementation(() => ({
    eq: vi.fn().mockReturnValue({
      error: options.deleteError ?? null,
    }),
  }));

  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    mockSingle,
  };
}

// ============================================================================
// TOTP Module Tests
// ============================================================================
describe('TOTP Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(0);
  });

  describe('generateSecret', () => {
    it('should generate a base32 encoded secret', () => {
      const secret = generateSecret();

      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(secret.length).toBe(32);
    });

    it('should generate unique secrets on each call', () => {
      const secret1 = generateSecret();
      const secret2 = generateSecret();

      expect(secret1).not.toBe(secret2);
    });

    it('should generate secrets of consistent length', () => {
      const secrets = Array.from({ length: 10 }, () => generateSecret());

      secrets.forEach((secret) => {
        expect(secret.length).toBe(32);
      });
    });
  });

  describe('generateTOTP', () => {
    it('should generate a TOTP code using the secret', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const code = generateTOTP(secret);

      expect(code).toBe('123456');
    });
  });

  describe('verifyTOTP', () => {
    it('should return true for a valid token', () => {
      mockValidate.mockReturnValue(0);

      const result = verifyTOTP('123456', 'JBSWY3DPEHPK3PXP');

      expect(result).toBe(true);
    });

    it('should return true for a token with valid time drift', () => {
      mockValidate.mockReturnValue(-1);

      const result = verifyTOTP('123455', 'JBSWY3DPEHPK3PXP');

      expect(result).toBe(true);
    });

    it('should return false for an invalid token', () => {
      mockValidate.mockReturnValue(null);

      const result = verifyTOTP('000000', 'JBSWY3DPEHPK3PXP');

      expect(result).toBe(false);
    });

    it('should handle empty token', () => {
      mockValidate.mockReturnValue(null);

      const result = verifyTOTP('', 'JBSWY3DPEHPK3PXP');

      expect(result).toBe(false);
    });
  });

  describe('getKeyUri', () => {
    it('should generate a valid otpauth URI', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const accountName = 'user@example.com';

      const uri = getKeyUri(secret, accountName);

      expect(uri).toContain('otpauth://totp/');
    });
  });

  describe('getRemainingSeconds', () => {
    it('should return a value between 1 and 30', () => {
      const remaining = getRemainingSeconds();

      expect(remaining).toBeGreaterThanOrEqual(1);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it('should return correct remaining seconds', () => {
      const mockTime = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(mockTime);

      const remaining = getRemainingSeconds();
      const expectedRemaining = 30 - (Math.floor(mockTime / 1000) % 30);

      expect(remaining).toBe(expectedRemaining);

      vi.restoreAllMocks();
    });
  });
});

// ============================================================================
// QR Code Module Tests
// ============================================================================
describe('QR Code Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToDataURL.mockResolvedValue('data:image/png;base64,mockQRCodeData');
    mockQRToString.mockResolvedValue('<svg>mock SVG content</svg>');
  });

  describe('generateQRCodeDataURL', () => {
    it('should generate a data URL for the QR code', async () => {
      const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';

      const dataUrl = await generateQRCodeDataURL(uri);

      expect(dataUrl).toBe('data:image/png;base64,mockQRCodeData');
      expect(mockToDataURL).toHaveBeenCalledWith(uri, expect.objectContaining({
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 2,
        width: 256,
      }));
    });

    it('should throw an error when QR code generation fails', async () => {
      mockToDataURL.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(generateQRCodeDataURL('invalid')).rejects.toThrow('Failed to generate QR code');
    });

    it('should handle empty URI', async () => {
      const dataUrl = await generateQRCodeDataURL('');

      expect(dataUrl).toBe('data:image/png;base64,mockQRCodeData');
    });
  });

  describe('generateQRCodeSVG', () => {
    it('should generate an SVG string for the QR code', async () => {
      const uri = 'otpauth://totp/Test:user@example.com?secret=TEST';

      const svg = await generateQRCodeSVG(uri);

      expect(svg).toBe('<svg>mock SVG content</svg>');
      expect(mockQRToString).toHaveBeenCalledWith(uri, expect.objectContaining({
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 256,
      }));
    });

    it('should throw an error when SVG generation fails', async () => {
      mockQRToString.mockRejectedValueOnce(new Error('Generation failed'));

      await expect(generateQRCodeSVG('invalid')).rejects.toThrow('Failed to generate QR code');
    });
  });
});

// ============================================================================
// Backup Codes Module Tests
// ============================================================================
describe('Backup Codes Module', () => {
  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const codes = generateBackupCodes();

      expect(codes).toHaveLength(10);
    });

    it('should generate the specified number of codes', () => {
      const codes = generateBackupCodes(5);

      expect(codes).toHaveLength(5);
    });

    it('should generate codes in uppercase hex format', () => {
      const codes = generateBackupCodes();

      codes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{8}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes(100);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(100);
    });

    it('should handle zero count', () => {
      const codes = generateBackupCodes(0);

      expect(codes).toHaveLength(0);
    });
  });

  describe('hashBackupCode', () => {
    it('should hash a backup code using SHA-256', () => {
      const code = 'ABCD1234';
      const hash = hashBackupCode(code);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for the same code', () => {
      const code = 'ABCD1234';
      const hash1 = hashBackupCode(code);
      const hash2 = hashBackupCode(code);

      expect(hash1).toBe(hash2);
    });

    it('should normalize codes to uppercase', () => {
      const hashLower = hashBackupCode('abcd1234');
      const hashUpper = hashBackupCode('ABCD1234');

      expect(hashLower).toBe(hashUpper);
    });

    it('should strip non-alphanumeric characters', () => {
      const hashWithDash = hashBackupCode('ABCD-1234');
      const hashWithout = hashBackupCode('ABCD1234');

      expect(hashWithDash).toBe(hashWithout);
    });

    it('should produce different hashes for different codes', () => {
      const hash1 = hashBackupCode('ABCD1234');
      const hash2 = hashBackupCode('EFGH5678');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash all codes in the array', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashes = hashBackupCodes(codes);

      expect(hashes).toHaveLength(2);
      hashes.forEach((hash) => {
        expect(hash).toHaveLength(64);
      });
    });

    it('should preserve order', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashes = hashBackupCodes(codes);

      expect(hashes[0]).toBe(hashBackupCode(codes[0]));
      expect(hashes[1]).toBe(hashBackupCode(codes[1]));
    });

    it('should handle empty array', () => {
      const hashes = hashBackupCodes([]);

      expect(hashes).toHaveLength(0);
    });
  });

  describe('verifyBackupCode', () => {
    it('should return true for a valid backup code', () => {
      const code = 'ABCD1234';
      const hashedCodes = [hashBackupCode(code), hashBackupCode('OTHER123')];

      const result = verifyBackupCode(code, hashedCodes);

      expect(result).toBe(true);
    });

    it('should return false for an invalid backup code', () => {
      const hashedCodes = [hashBackupCode('ABCD1234')];

      const result = verifyBackupCode('INVALID1', hashedCodes);

      expect(result).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const code = 'ABCD1234';
      const hashedCodes = [hashBackupCode(code)];

      const result = verifyBackupCode('abcd1234', hashedCodes);

      expect(result).toBe(true);
    });

    it('should handle formatted codes with dashes', () => {
      const code = 'ABCD1234';
      const hashedCodes = [hashBackupCode(code)];

      const result = verifyBackupCode('ABCD-1234', hashedCodes);

      expect(result).toBe(true);
    });

    it('should return false for empty hashed codes array', () => {
      const result = verifyBackupCode('ABCD1234', []);

      expect(result).toBe(false);
    });
  });

  describe('formatBackupCode', () => {
    it('should format code with a dash in the middle', () => {
      const formatted = formatBackupCode('ABCD1234');

      expect(formatted).toBe('ABCD-1234');
    });

    it('should handle shorter codes', () => {
      const formatted = formatBackupCode('ABCD');

      expect(formatted).toBe('ABCD-');
    });

    it('should handle longer codes', () => {
      const formatted = formatBackupCode('ABCD12345678');

      expect(formatted).toBe('ABCD-12345678');
    });
  });

  describe('parseBackupCode', () => {
    it('should remove dashes and convert to uppercase', () => {
      const parsed = parseBackupCode('abcd-1234');

      expect(parsed).toBe('ABCD1234');
    });

    it('should handle multiple dashes', () => {
      const parsed = parseBackupCode('ab-cd-12-34');

      expect(parsed).toBe('ABCD1234');
    });

    it('should handle code without dashes', () => {
      const parsed = parseBackupCode('abcd1234');

      expect(parsed).toBe('ABCD1234');
    });

    it('should handle already uppercase code', () => {
      const parsed = parseBackupCode('ABCD-1234');

      expect(parsed).toBe('ABCD1234');
    });
  });
});

// ============================================================================
// Integration Functions Tests (with mocked Supabase)
// ============================================================================
describe('2FA Integration Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(0);
    mockSupabaseRpc.mockResolvedValue({ data: 0 });
  });

  describe('setupTwoFactor', () => {
    it('should set up 2FA for a new user', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: null,
        selectError: null,
        insertError: null,
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await setupTwoFactor('user-123', 'user@example.com');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,mockQRCodeData');
    });

    it('should throw error if 2FA is already verified', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: { id: 'existing-id', verified: true },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      await expect(setupTwoFactor('user-123', 'user@example.com')).rejects.toThrow(
        'Two-factor authentication is already enabled'
      );
    });

    it('should throw error on database insert failure', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: null,
        insertError: { message: 'Database error' },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      await expect(setupTwoFactor('user-123', 'user@example.com')).rejects.toThrow(
        'Failed to create 2FA setup: Database error'
      );
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    it('should return false for invalid token', async () => {
      mockValidate.mockReturnValue(null);
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          verified: false,
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await verifyAndEnableTwoFactor('user-123', '000000');

      expect(result).toBe(false);
    });

    it('should throw error if 2FA is not set up', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: null,
        selectError: { message: 'Not found' },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      await expect(verifyAndEnableTwoFactor('user-123', '123456')).rejects.toThrow(
        'Two-factor authentication not set up'
      );
    });

    it('should throw error if 2FA is already verified', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          verified: true,
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      await expect(verifyAndEnableTwoFactor('user-123', '123456')).rejects.toThrow(
        'Two-factor authentication already verified'
      );
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('should throw error when too many failed attempts', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: 5 });

      await expect(verifyTwoFactorToken('user-123', '123456')).rejects.toThrow(
        'Too many failed attempts. Please try again later.'
      );
    });

    it('should return false if 2FA is not enabled', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          enabled: false,
          verified: true,
          backup_codes_hash: [],
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await verifyTwoFactorToken('user-123', '123456');

      expect(result).toBe(false);
    });

    it('should return false if 2FA is not verified', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          enabled: true,
          verified: false,
          backup_codes_hash: [],
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await verifyTwoFactorToken('user-123', '123456');

      expect(result).toBe(false);
    });

    it('should return false for invalid TOTP token', async () => {
      mockValidate.mockReturnValue(null);
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          enabled: true,
          verified: true,
          backup_codes_hash: [],
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await verifyTwoFactorToken('user-123', '000000');

      expect(result).toBe(false);
    });
  });

  describe('disableTwoFactor', () => {
    it('should return false with invalid token', async () => {
      mockValidate.mockReturnValue(null);
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          enabled: true,
          verified: true,
          backup_codes_hash: [],
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await disableTwoFactor('user-123', '000000');

      expect(result).toBe(false);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should throw error with invalid token', async () => {
      mockValidate.mockReturnValue(null);
      const mockChain = createSupabaseMockChain({
        selectData: {
          id: '2fa-id',
          secret_encrypted: { iv: 'test', data: 'test', tag: 'test', v: 1 },
          enabled: true,
          verified: true,
          backup_codes_hash: [],
        },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      await expect(regenerateBackupCodes('user-123', '000000')).rejects.toThrow(
        'Invalid verification code'
      );
    });
  });

  describe('getTwoFactorStatus', () => {
    it('should return default status for user without 2FA', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: null,
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await getTwoFactorStatus('user-123');

      expect(result).toEqual({
        enabled: false,
        verified: false,
        lastUsedAt: null,
        backupCodesRemaining: 0,
      });
    });
  });

  describe('isTwoFactorRequired', () => {
    it('should return true if 2FA is enabled and verified', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: { enabled: true, verified: true },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await isTwoFactorRequired('user-123');

      expect(result).toBe(true);
    });

    it('should return false if 2FA is not enabled', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: { enabled: false, verified: true },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await isTwoFactorRequired('user-123');

      expect(result).toBe(false);
    });

    it('should return false if 2FA is not verified', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: { enabled: true, verified: false },
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await isTwoFactorRequired('user-123');

      expect(result).toBe(false);
    });

    it('should return false if no 2FA record exists', async () => {
      const mockChain = createSupabaseMockChain({
        selectData: null,
      });
      mockSupabaseFrom.mockReturnValue(mockChain);

      const result = await isTwoFactorRequired('user-123');

      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// Edge Cases and Security Tests
// ============================================================================
describe('Edge Cases and Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(null);
  });

  describe('Token validation edge cases', () => {
    it('should reject tokens that are too short', () => {
      const result = verifyTOTP('12345', 'JBSWY3DPEHPK3PXP');
      expect(result).toBe(false);
    });

    it('should reject tokens that are too long', () => {
      const result = verifyTOTP('1234567', 'JBSWY3DPEHPK3PXP');
      expect(result).toBe(false);
    });

    it('should reject tokens with non-numeric characters', () => {
      const result = verifyTOTP('12345a', 'JBSWY3DPEHPK3PXP');
      expect(result).toBe(false);
    });
  });

  describe('Backup code edge cases', () => {
    it('should handle backup codes with mixed case', () => {
      const code = 'AbCd1234';
      const hashedCodes = [hashBackupCode('ABCD1234')];

      expect(verifyBackupCode(code, hashedCodes)).toBe(true);
    });

    it('should handle backup codes with spaces', () => {
      const code = 'ABCD 1234';
      const hashedCodes = [hashBackupCode('ABCD1234')];

      const parsed = parseBackupCode(code);
      expect(verifyBackupCode(parsed, hashedCodes)).toBe(true);
    });
  });

  describe('Base32 encoding', () => {
    it('should generate valid base32 characters only', () => {
      for (let i = 0; i < 20; i++) {
        const secret = generateSecret();
        expect(secret).toMatch(/^[A-Z2-7]+$/);
      }
    });
  });

  describe('Cryptographic operations', () => {
    it('should use crypto.randomBytes for backup code generation', () => {
      const randomBytesSpy = vi.spyOn(crypto, 'randomBytes');

      generateBackupCodes(1);

      expect(randomBytesSpy).toHaveBeenCalled();
      randomBytesSpy.mockRestore();
    });

    it('should use SHA-256 for hashing backup codes', () => {
      const hash = hashBackupCode('ABCD1234');

      expect(hash).toHaveLength(64);

      const expectedHash = crypto
        .createHash('sha256')
        .update('ABCD1234')
        .digest('hex');
      expect(hash).toBe(expectedHash);
    });
  });
});
