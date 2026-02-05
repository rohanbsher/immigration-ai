import { describe, it, expect } from 'vitest';
import { safeCompare, safeCompareSecrets } from './timing-safe';

describe('timing-safe', () => {
  describe('safeCompare', () => {
    it('returns true for identical strings', () => {
      expect(safeCompare('secret123', 'secret123')).toBe(true);
      expect(safeCompare('a', 'a')).toBe(true);
      expect(safeCompare('', '')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(safeCompare('secret123', 'secret456')).toBe(false);
      expect(safeCompare('aaa', 'bbb')).toBe(false);
    });

    it('returns false for different length strings', () => {
      expect(safeCompare('short', 'verylongstring')).toBe(false);
      expect(safeCompare('', 'notempty')).toBe(false);
      expect(safeCompare('notempty', '')).toBe(false);
    });

    it('handles special characters', () => {
      expect(safeCompare('pass!@#$%', 'pass!@#$%')).toBe(true);
      expect(safeCompare('pass!@#$%', 'pass!@#$&')).toBe(false);
    });

    it('handles unicode', () => {
      expect(safeCompare('密码', '密码')).toBe(true);
      expect(safeCompare('密码', '密碼')).toBe(false);
    });
  });

  describe('safeCompareSecrets', () => {
    it('returns false when provided is null', () => {
      expect(safeCompareSecrets(null, 'expected')).toBe(false);
    });

    it('returns false when provided is undefined', () => {
      expect(safeCompareSecrets(undefined, 'expected')).toBe(false);
    });

    it('returns false when expected is null', () => {
      expect(safeCompareSecrets('provided', null)).toBe(false);
    });

    it('returns false when expected is undefined', () => {
      expect(safeCompareSecrets('provided', undefined)).toBe(false);
    });

    it('returns false when both are null', () => {
      expect(safeCompareSecrets(null, null)).toBe(false);
    });

    it('returns false when both are undefined', () => {
      expect(safeCompareSecrets(undefined, undefined)).toBe(false);
    });

    it('returns false when provided is empty string', () => {
      expect(safeCompareSecrets('', 'expected')).toBe(false);
    });

    it('returns false when expected is empty string', () => {
      expect(safeCompareSecrets('provided', '')).toBe(false);
    });

    it('returns true for matching non-empty strings', () => {
      expect(safeCompareSecrets('match', 'match')).toBe(true);
      expect(safeCompareSecrets('Bearer token123', 'Bearer token123')).toBe(true);
    });

    it('returns false for non-matching strings', () => {
      expect(safeCompareSecrets('secret1', 'secret2')).toBe(false);
    });
  });
});
