import { describe, it, expect } from 'vitest';
import { cn, formatDate } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'included', false && 'excluded');
    expect(result).toBe('base included');
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('should handle undefined and null', () => {
    const result = cn('foo', undefined, null, 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('should handle objects', () => {
    const result = cn({
      foo: true,
      bar: false,
      baz: true,
    });
    expect(result).toBe('foo baz');
  });

  it('should handle mixed inputs', () => {
    const result = cn(
      'base',
      ['array-class'],
      { 'object-class': true },
      'final'
    );
    expect(result).toBe('base array-class object-class final');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should deduplicate conflicting tailwind utilities', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('should handle responsive prefixes', () => {
    const result = cn('md:px-2', 'md:px-4');
    expect(result).toBe('md:px-4');
  });
});

describe('formatDate', () => {
  it('returns null for null input', () => {
    expect(formatDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatDate('')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(formatDate('not-a-date')).toBeNull();
  });

  it('returns formatted en-US string for valid ISO date', () => {
    expect(formatDate('2025-06-15T10:30:00Z')).toBe('6/15/2025');
  });

  it('returns formatted en-US string for valid date-only string (UTC-safe)', () => {
    // Date-only strings are parsed as UTC midnight; must not shift to previous day
    expect(formatDate('2025-01-01')).toBe('1/1/2025');
  });
});
