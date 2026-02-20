/**
 * Comprehensive tests for backup code generation and verification.
 *
 * Security-critical module: backup codes are the last-resort recovery path for 2FA.
 * Tests cover:
 * - Entropy and randomness guarantees
 * - Timing-safe comparison (prevents timing attacks)
 * - Normalization (case, dashes, spaces)
 * - Edge cases (empty inputs, boundary lengths)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

import {
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodes,
  verifyBackupCode,
  formatBackupCode,
  parseBackupCode,
} from './backup-codes';

describe('generateBackupCodes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates 10 codes by default', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
  });

  it('generates the specified number of codes', () => {
    expect(generateBackupCodes(1)).toHaveLength(1);
    expect(generateBackupCodes(5)).toHaveLength(5);
    expect(generateBackupCodes(20)).toHaveLength(20);
  });

  it('generates 0 codes when count is 0', () => {
    expect(generateBackupCodes(0)).toHaveLength(0);
  });

  it('generates 32-char uppercase hex codes (128 bits entropy)', () => {
    const codes = generateBackupCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{32}$/);
      expect(code.length).toBe(32);
    }
  });

  it('generates unique codes within a batch', () => {
    const codes = generateBackupCodes(100);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(100);
  });

  it('generates different codes across calls', () => {
    const batch1 = generateBackupCodes(10);
    const batch2 = generateBackupCodes(10);
    const allCodes = new Set([...batch1, ...batch2]);
    expect(allCodes.size).toBe(20);
  });

  it('uses crypto.randomBytes for generation', () => {
    const spy = vi.spyOn(crypto, 'randomBytes');
    generateBackupCodes(3);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(16); // 16 bytes = 128 bits
    spy.mockRestore();
  });
});

describe('hashBackupCode', () => {
  it('produces a 64-char hex string (SHA-256)', () => {
    const hash = hashBackupCode('ABCDEF1234567890ABCDEF1234567890');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it('produces consistent hashes for the same input', () => {
    const code = 'ABCDEF1234567890ABCDEF1234567890';
    expect(hashBackupCode(code)).toBe(hashBackupCode(code));
  });

  it('normalizes to uppercase before hashing', () => {
    expect(hashBackupCode('abcdef1234567890abcdef1234567890')).toBe(
      hashBackupCode('ABCDEF1234567890ABCDEF1234567890')
    );
  });

  it('normalizes mixed case before hashing', () => {
    expect(hashBackupCode('AbCdEf1234567890AbCdEf1234567890')).toBe(
      hashBackupCode('ABCDEF1234567890ABCDEF1234567890')
    );
  });

  it('strips non-alphanumeric characters before hashing', () => {
    expect(hashBackupCode('ABCD-EF12-3456-7890')).toBe(
      hashBackupCode('ABCDEF1234567890')
    );
  });

  it('strips spaces before hashing', () => {
    expect(hashBackupCode('ABCD EF12 3456 7890')).toBe(
      hashBackupCode('ABCDEF1234567890')
    );
  });

  it('produces different hashes for different codes', () => {
    const hash1 = hashBackupCode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1');
    const hash2 = hashBackupCode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2');
    expect(hash1).not.toBe(hash2);
  });

  it('matches expected SHA-256 digest', () => {
    const code = 'TESTCODE';
    const expected = crypto.createHash('sha256').update('TESTCODE').digest('hex');
    expect(hashBackupCode(code)).toBe(expected);
  });
});

describe('hashBackupCodes', () => {
  it('hashes all codes in the array', () => {
    const codes = ['CODE1', 'CODE2', 'CODE3'];
    const hashes = hashBackupCodes(codes);
    expect(hashes).toHaveLength(3);
    for (const hash of hashes) {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('preserves order', () => {
    const codes = ['AAAA', 'BBBB', 'CCCC'];
    const hashes = hashBackupCodes(codes);
    expect(hashes[0]).toBe(hashBackupCode('AAAA'));
    expect(hashes[1]).toBe(hashBackupCode('BBBB'));
    expect(hashes[2]).toBe(hashBackupCode('CCCC'));
  });

  it('returns empty array for empty input', () => {
    expect(hashBackupCodes([])).toEqual([]);
  });
});

describe('verifyBackupCode', () => {
  it('returns true for a valid code present in hashed list', () => {
    const code = 'ABCDEF1234567890ABCDEF1234567890';
    const hashes = [hashBackupCode(code)];
    expect(verifyBackupCode(code, hashes)).toBe(true);
  });

  it('returns false for a code not in the list', () => {
    const hashes = [hashBackupCode('VALIDCODE')];
    expect(verifyBackupCode('INVALIDCODE', hashes)).toBe(false);
  });

  it('handles case-insensitive input', () => {
    const code = 'ABCDEF1234567890';
    const hashes = [hashBackupCode(code)];
    expect(verifyBackupCode('abcdef1234567890', hashes)).toBe(true);
  });

  it('handles codes with dashes', () => {
    const code = 'ABCD1234';
    const hashes = [hashBackupCode(code)];
    expect(verifyBackupCode('ABCD-1234', hashes)).toBe(true);
  });

  it('returns false for empty hashed codes array', () => {
    expect(verifyBackupCode('ANYTHING', [])).toBe(false);
  });

  it('finds code among multiple hashed codes', () => {
    const target = 'TARGETCODE123456';
    const hashes = [
      hashBackupCode('DECOY1'),
      hashBackupCode('DECOY2'),
      hashBackupCode(target),
      hashBackupCode('DECOY3'),
    ];
    expect(verifyBackupCode(target, hashes)).toBe(true);
  });

  it('uses timing-safe comparison (always iterates all codes)', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    const code = 'TESTCODE';
    const hashes = [
      hashBackupCode('OTHER1'),
      hashBackupCode('OTHER2'),
      hashBackupCode(code),
      hashBackupCode('OTHER3'),
    ];

    verifyBackupCode(code, hashes);

    // timingSafeEqual should be called for ALL codes, not short-circuit on match
    expect(spy).toHaveBeenCalledTimes(4);
    spy.mockRestore();
  });

  it('prevents timing attacks by checking all codes even after finding match', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    const code = 'MATCHFIRST';
    const hashes = [
      hashBackupCode(code), // match is first
      hashBackupCode('SECOND'),
      hashBackupCode('THIRD'),
    ];

    const result = verifyBackupCode(code, hashes);

    expect(result).toBe(true);
    // Must check all 3, not just the first
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('returns false when code hash length differs from stored hash length', () => {
    // This tests the buffer length check in verifyBackupCode
    // A stored hash of different length should not match
    const code = 'TESTCODE';
    const truncatedHash = hashBackupCode(code).slice(0, 32); // artificially short
    expect(verifyBackupCode(code, [truncatedHash])).toBe(false);
  });
});

describe('formatBackupCode', () => {
  it('formats 8-char code as XXXX-XXXX', () => {
    expect(formatBackupCode('ABCD1234')).toBe('ABCD-1234');
  });

  it('formats 32-char code as 8 groups of 4', () => {
    const code = 'ABCDEF1234567890ABCDEF1234567890';
    const expected = 'ABCD-EF12-3456-7890-ABCD-EF12-3456-7890';
    expect(formatBackupCode(code)).toBe(expected);
  });

  it('formats 12-char code as XXXX-XXXX-XXXX', () => {
    expect(formatBackupCode('ABCDEF123456')).toBe('ABCD-EF12-3456');
  });

  it('handles codes shorter than 4 chars without dashes', () => {
    expect(formatBackupCode('ABC')).toBe('ABC');
  });

  it('handles exactly 4-char code without dashes', () => {
    expect(formatBackupCode('ABCD')).toBe('ABCD');
  });

  it('handles empty string', () => {
    expect(formatBackupCode('')).toBe('');
  });
});

describe('parseBackupCode', () => {
  it('removes dashes and converts to uppercase', () => {
    expect(parseBackupCode('abcd-1234')).toBe('ABCD1234');
  });

  it('removes multiple dashes', () => {
    expect(parseBackupCode('ab-cd-12-34')).toBe('ABCD1234');
  });

  it('handles code without dashes', () => {
    expect(parseBackupCode('abcd1234')).toBe('ABCD1234');
  });

  it('handles already uppercase code with dashes', () => {
    expect(parseBackupCode('ABCD-1234')).toBe('ABCD1234');
  });

  it('handles 32-char formatted code', () => {
    const formatted = 'ABCD-EF12-3456-7890-ABCD-EF12-3456-7890';
    expect(parseBackupCode(formatted)).toBe('ABCDEF1234567890ABCDEF1234567890');
  });

  it('handles empty string', () => {
    expect(parseBackupCode('')).toBe('');
  });
});

describe('roundtrip: generate -> hash -> verify', () => {
  it('freshly generated codes verify against their hashes', () => {
    const codes = generateBackupCodes(10);
    const hashes = hashBackupCodes(codes);

    for (const code of codes) {
      expect(verifyBackupCode(code, hashes)).toBe(true);
    }
  });

  it('formatted codes verify against their hashes', () => {
    const codes = generateBackupCodes(5);
    const hashes = hashBackupCodes(codes);

    for (const code of codes) {
      const formatted = formatBackupCode(code);
      const parsed = parseBackupCode(formatted);
      expect(verifyBackupCode(parsed, hashes)).toBe(true);
    }
  });

  it('lowercase input verifies against hashes of uppercase codes', () => {
    const codes = generateBackupCodes(5);
    const hashes = hashBackupCodes(codes);

    for (const code of codes) {
      expect(verifyBackupCode(code.toLowerCase(), hashes)).toBe(true);
    }
  });
});
