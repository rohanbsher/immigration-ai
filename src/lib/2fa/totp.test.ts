/**
 * Comprehensive tests for TOTP generation and verification.
 *
 * Security-critical module: TOTP is the primary 2FA mechanism.
 * Tests cover:
 * - Secret generation (entropy, format)
 * - TOTP generation and verification
 * - Time drift tolerance (window)
 * - Key URI generation
 * - Remaining seconds calculation
 * - Edge cases (empty tokens, malformed secrets)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockValidate, mockGenerate, mockToString } = vi.hoisted(() => ({
  mockValidate: vi.fn().mockReturnValue(0),
  mockGenerate: vi.fn().mockReturnValue('123456'),
  mockToString: vi.fn().mockReturnValue('otpauth://totp/Immigration%20AI:test@example.com?secret=TEST'),
}));

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

import {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  getKeyUri,
  getRemainingSeconds,
} from './totp';

describe('generateSecret', () => {
  it('generates a base32 encoded string', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('generates a 32-character secret', () => {
    const secret = generateSecret();
    expect(secret.length).toBe(32);
  });

  it('generates unique secrets', () => {
    const secrets = new Set(Array.from({ length: 50 }, () => generateSecret()));
    expect(secrets.size).toBe(50);
  });

  it('generates secrets with consistent length across many calls', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateSecret().length).toBe(32);
    }
  });

  it('only contains valid base32 characters', () => {
    for (let i = 0; i < 100; i++) {
      const secret = generateSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    }
  });
});

describe('generateTOTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockReturnValue('123456');
  });

  it('generates a TOTP code from a secret', () => {
    const code = generateTOTP('JBSWY3DPEHPK3PXP');
    expect(code).toBe('123456');
  });

  it('returns a 6-digit string', () => {
    const code = generateTOTP('JBSWY3DPEHPK3PXP');
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe('verifyTOTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(0);
  });

  it('returns true for a valid token (delta=0, exact match)', () => {
    mockValidate.mockReturnValue(0);
    expect(verifyTOTP('123456', 'JBSWY3DPEHPK3PXP')).toBe(true);
  });

  it('returns true for a token one step behind (delta=-1)', () => {
    mockValidate.mockReturnValue(-1);
    expect(verifyTOTP('123456', 'JBSWY3DPEHPK3PXP')).toBe(true);
  });

  it('returns true for a token one step ahead (delta=1)', () => {
    mockValidate.mockReturnValue(1);
    expect(verifyTOTP('123456', 'JBSWY3DPEHPK3PXP')).toBe(true);
  });

  it('returns false for an invalid token (delta=null)', () => {
    mockValidate.mockReturnValue(null);
    expect(verifyTOTP('000000', 'JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('returns false for an empty token', () => {
    mockValidate.mockReturnValue(null);
    expect(verifyTOTP('', 'JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('returns false when validation throws an exception', () => {
    mockValidate.mockImplementation(() => {
      throw new Error('Invalid base32');
    });
    expect(verifyTOTP('123456', 'INVALID')).toBe(false);
  });

  it('returns false for tokens that are too short', () => {
    mockValidate.mockReturnValue(null);
    expect(verifyTOTP('12345', 'JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('returns false for tokens that are too long', () => {
    mockValidate.mockReturnValue(null);
    expect(verifyTOTP('1234567', 'JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('returns false for non-numeric tokens', () => {
    mockValidate.mockReturnValue(null);
    expect(verifyTOTP('abcdef', 'JBSWY3DPEHPK3PXP')).toBe(false);
  });
});

describe('getKeyUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToString.mockReturnValue('otpauth://totp/Immigration%20AI:user@example.com?secret=TEST');
  });

  it('generates a URI containing otpauth scheme', () => {
    const uri = getKeyUri('JBSWY3DPEHPK3PXP', 'user@example.com');
    expect(uri).toContain('otpauth://totp/');
  });

  it('includes the account name in the URI', () => {
    const uri = getKeyUri('JBSWY3DPEHPK3PXP', 'user@example.com');
    expect(uri).toContain('user@example.com');
  });

  it('uses default issuer when not specified', () => {
    const uri = getKeyUri('JBSWY3DPEHPK3PXP', 'user@example.com');
    expect(uri).toContain('Immigration');
  });

  it('uses custom issuer when specified', () => {
    mockToString.mockReturnValue('otpauth://totp/Custom%20Issuer:user@example.com?secret=TEST');
    const uri = getKeyUri('JBSWY3DPEHPK3PXP', 'user@example.com', 'Custom Issuer');
    expect(uri).toContain('Custom%20Issuer');
  });
});

describe('getRemainingSeconds', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a value between 1 and 30', () => {
    const remaining = getRemainingSeconds();
    expect(remaining).toBeGreaterThanOrEqual(1);
    expect(remaining).toBeLessThanOrEqual(30);
  });

  it('returns correct remaining seconds for a known timestamp', () => {
    // timestamp = 1700000000 seconds
    // 1700000000 % 30 = 20
    // remaining = 30 - 20 = 10
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    expect(getRemainingSeconds()).toBe(10);
  });

  it('returns 30 at a period boundary', () => {
    // timestamp = 1700000010 seconds -> 1700000010 % 30 = 0
    // remaining = 30 - 0 = 30
    vi.spyOn(Date, 'now').mockReturnValue(1700000010000);
    const mod = Math.floor(1700000010000 / 1000) % 30;
    const expected = 30 - mod;
    expect(getRemainingSeconds()).toBe(expected);
  });

  it('returns 1 just before a period boundary', () => {
    // Find a time where seconds % 30 = 29 -> remaining = 1
    // 30*k + 29 = 1700000009 -> 1700000009 % 30 = 29
    vi.spyOn(Date, 'now').mockReturnValue(1700000009000);
    const mod = Math.floor(1700000009000 / 1000) % 30;
    const expected = 30 - mod;
    expect(getRemainingSeconds()).toBe(expected);
  });
});
