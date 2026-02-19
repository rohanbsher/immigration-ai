import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

import {
  withAIFallback,
  extractTextContent,
  calculateWeightedScore,
  formatDocumentType,
  formatVisaType,
  getConfidenceLevel,
  getSuccessScoreStatus,
  truncateText,
} from './utils';

describe('withAIFallback', () => {
  it('returns result with source "ai" on success', async () => {
    const aiCall = async () => 'ai-result';
    const fallback = () => 'fallback-result';

    const outcome = await withAIFallback(aiCall, fallback);
    expect(outcome).toEqual({ result: 'ai-result', source: 'ai' });
  });

  it('returns result with source "fallback" and error on failure', async () => {
    const aiCall = async () => { throw new Error('AI broke'); };
    const fallback = () => 'fallback-result';

    const outcome = await withAIFallback(aiCall, fallback);
    expect(outcome.result).toBe('fallback-result');
    expect(outcome.source).toBe('fallback');
    expect(outcome.error).toBe('AI broke');
  });
});

describe('extractTextContent', () => {
  it('finds the text block and returns its text', () => {
    const content = [
      { type: 'image', text: undefined },
      { type: 'text', text: 'Hello world' },
    ];
    expect(extractTextContent(content)).toBe('Hello world');
  });

  it('returns empty string for empty array', () => {
    expect(extractTextContent([])).toBe('');
  });

  it('returns empty string when no text type exists', () => {
    const content = [{ type: 'image' }, { type: 'tool_use' }];
    expect(extractTextContent(content)).toBe('');
  });
});

describe('calculateWeightedScore', () => {
  it('calculates a normal weighted average', () => {
    const factors = [
      { value: 80, weight: 2 },
      { value: 60, weight: 1 },
    ];
    // (80*2 + 60*1) / (2+1) = 220/3 = 73.33 -> 73
    expect(calculateWeightedScore(factors)).toBe(73);
  });

  it('returns 0 for empty array', () => {
    expect(calculateWeightedScore([])).toBe(0);
  });

  it('handles single item', () => {
    expect(calculateWeightedScore([{ value: 50, weight: 1 }])).toBe(50);
  });

  it('returns 0 when all weights are zero', () => {
    const factors = [
      { value: 100, weight: 0 },
      { value: 50, weight: 0 },
    ];
    expect(calculateWeightedScore(factors)).toBe(0);
  });
});

describe('formatDocumentType', () => {
  it('formats "birth_certificate" to "Birth Certificate"', () => {
    expect(formatDocumentType('birth_certificate')).toBe('Birth Certificate');
  });

  it('formats "passport" to "Passport"', () => {
    expect(formatDocumentType('passport')).toBe('Passport');
  });
});

describe('formatVisaType', () => {
  it('converts "H1B" to "H-1B"', () => {
    expect(formatVisaType('H1B')).toBe('H-1B');
  });

  it('returns "I-485" as-is when it already contains a hyphen', () => {
    expect(formatVisaType('I-485')).toBe('I-485');
  });

  it('returns "other" as-is for non-matching patterns', () => {
    expect(formatVisaType('other')).toBe('other');
  });

  it('does not format lowercase input (regex requires uppercase)', () => {
    expect(formatVisaType('h1b')).toBe('h1b');
  });
});

describe('getConfidenceLevel', () => {
  it('returns "high" for 0.95', () => {
    expect(getConfidenceLevel(0.95)).toBe('high');
  });

  it('returns "high" for exactly 0.9', () => {
    expect(getConfidenceLevel(0.9)).toBe('high');
  });

  it('returns "medium" for 0.89', () => {
    expect(getConfidenceLevel(0.89)).toBe('medium');
  });

  it('returns "medium" for exactly 0.7', () => {
    expect(getConfidenceLevel(0.7)).toBe('medium');
  });

  it('returns "low" for 0.69', () => {
    expect(getConfidenceLevel(0.69)).toBe('low');
  });

  it('returns "low" for 0.1', () => {
    expect(getConfidenceLevel(0.1)).toBe('low');
  });
});

describe('getSuccessScoreStatus', () => {
  it('returns "excellent" for 90', () => {
    expect(getSuccessScoreStatus(90)).toBe('excellent');
  });

  it('returns "excellent" for exactly 80', () => {
    expect(getSuccessScoreStatus(80)).toBe('excellent');
  });

  it('returns "good" for 79', () => {
    expect(getSuccessScoreStatus(79)).toBe('good');
  });

  it('returns "good" for exactly 60', () => {
    expect(getSuccessScoreStatus(60)).toBe('good');
  });

  it('returns "fair" for 59', () => {
    expect(getSuccessScoreStatus(59)).toBe('fair');
  });

  it('returns "fair" for exactly 40', () => {
    expect(getSuccessScoreStatus(40)).toBe('fair');
  });

  it('returns "poor" for 39', () => {
    expect(getSuccessScoreStatus(39)).toBe('poor');
  });
});

describe('truncateText', () => {
  it('returns short text unchanged', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('returns text unchanged when length equals maxLength', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });

  it('truncates text over the limit with "..."', () => {
    expect(truncateText('hello world!', 8)).toBe('hello...');
  });

  it('handles maxLength of exactly 3 (edge case)', () => {
    expect(truncateText('hello', 3)).toBe('...');
  });

  it('handles maxLength less than 3', () => {
    // Source bug: maxLength < 3 produces output longer than maxLength
    // This documents the current behavior
    expect(truncateText('hello', 1)).toBe('hel...');
  });
});
