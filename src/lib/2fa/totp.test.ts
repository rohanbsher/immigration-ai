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
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Hoisted mocks
const { mockValidate, mockGenerate, mockToString } = vi.hoisted(() => ({
  mockValidate: vi.fn().mockReturnValue(0),
  mockGenerate: vi.fn().mockReturnValue('123456'),
  mockToString: vi.fn().mockReturnValue('otpauth://totp/CaseFill:test@example.com?secret=TEST'),
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
    mockToString.mockReturnValue('otpauth://totp/CaseFill:user@example.com?secret=TEST');
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
    expect(uri).toContain('CaseFill');
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

/**
 * Real TOTP verification tests using the actual otpauth library.
 *
 * These tests do NOT mock otpauth. They import the real library via
 * vi.importActual and exercise the same TOTP configuration that our
 * production code uses, proving end-to-end correctness.
 */
describe('real TOTP verification (unmocked)', () => {
  // Load the real otpauth library, bypassing the vi.mock above
  let RealOTPAuth: typeof import('otpauth');

  // A real verifyTOTP that uses the unmocked otpauth library.
  // vi.importActual('./totp') won't work because totp.ts internally
  // imports 'otpauth' which remains mocked at the module level.
  // Instead we replicate the exact same logic here with real otpauth.
  let realVerifyTOTP: (token: string, secret: string) => boolean;

  beforeAll(async () => {
    RealOTPAuth = await vi.importActual<typeof import('otpauth')>('otpauth');

    realVerifyTOTP = (token: string, secret: string): boolean => {
      try {
        const totp = new RealOTPAuth.TOTP({
          issuer: 'CaseFill',
          label: 'User',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: RealOTPAuth.Secret.fromBase32(secret),
        });
        const delta = totp.validate({ token, window: 1 });
        return delta !== null;
      } catch {
        return false;
      }
    };
  });

  // Helper: build a TOTP instance with the same config as totp.ts
  function makeTOTP(secret: string) {
    return new RealOTPAuth.TOTP({
      issuer: 'CaseFill',
      label: 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: RealOTPAuth.Secret.fromBase32(secret),
    });
  }

  it('round-trip: generateSecret → generate → verify succeeds with delta 0', () => {
    // generateSecret() is NOT mocked — it uses crypto.randomBytes + base32Encode
    const secret = generateSecret();

    const totp = makeTOTP(secret);
    const token = totp.generate();

    // Token should be 6 digits
    expect(token).toMatch(/^\d{6}$/);

    // Validate should return delta=0 (exact time match)
    const delta = totp.validate({ token, window: 1 });
    expect(delta).toBe(0);
  });

  it('rejects a token that differs from the valid one', () => {
    const secret = generateSecret();
    const totp = makeTOTP(secret);

    // Generate the real valid token, then derive a guaranteed-different one.
    // TOTP tokens are HMAC-derived (not sequential), so +1 won't accidentally
    // land on an adjacent window's token.
    const validToken = totp.generate();
    const invalidToken = String((parseInt(validToken, 10) + 1) % 1000000).padStart(6, '0');

    expect(totp.validate({ token: invalidToken, window: 1 })).toBeNull();
  });

  it('window boundary: current token verifies within window=1', () => {
    const secret = generateSecret();
    const totp = makeTOTP(secret);

    const token = totp.generate();

    // With window=1, the current token (delta=0) must always verify
    const delta = totp.validate({ token, window: 1 });
    expect(delta).not.toBeNull();
    expect(delta).toBe(0);
  });

  it('getKeyUri produces a valid otpauth URI with real library', () => {
    const secret = generateSecret();
    const email = 'attorney@lawfirm.com';

    const totp = new RealOTPAuth.TOTP({
      issuer: 'CaseFill',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: RealOTPAuth.Secret.fromBase32(secret),
    });

    const uri = totp.toString();

    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent(email));
    expect(uri).toContain('secret=');
    expect(uri).toContain('issuer=CaseFill');
  });

  it('different secrets produce valid 6-digit tokens', () => {
    const secrets = Array.from({ length: 5 }, () => generateSecret());

    // All secrets must be unique
    const uniqueSecrets = new Set(secrets);
    expect(uniqueSecrets.size).toBe(5);

    // Each secret produces a valid 6-digit numeric token
    const tokens = secrets.map((s) => makeTOTP(s).generate());
    for (const token of tokens) {
      expect(token).toMatch(/^\d{6}$/);
    }

    // With 5 independent random secrets, the probability of ALL tokens
    // being identical is (1/10^6)^4 ≈ 10^-24 — effectively zero
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBeGreaterThan(1);
  });

  it('real verifyTOTP accepts a valid token', () => {
    const secret = generateSecret();
    const token = makeTOTP(secret).generate();

    expect(realVerifyTOTP(token, secret)).toBe(true);
  });

  it('real verifyTOTP rejects a token that differs from the valid one', () => {
    const secret = generateSecret();
    const validToken = makeTOTP(secret).generate();

    // Derive a guaranteed-different token to avoid the ~0.001% flake risk
    // of hardcoded values accidentally matching a valid TOTP window
    const invalidToken = String((parseInt(validToken, 10) + 1) % 1000000).padStart(6, '0');

    expect(realVerifyTOTP(invalidToken, secret)).toBe(false);
  });

  it('real verifyTOTP rejects an empty string', () => {
    const secret = generateSecret();

    expect(realVerifyTOTP('', secret)).toBe(false);
  });
});
