import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROCESSING_TIMES,
  getProcessingTime,
  formatProcessingTime,
  calculateEstimatedCompletion,
} from './processing-times';

describe('DEFAULT_PROCESSING_TIMES', () => {
  it('has all 11 expected form types', () => {
    const expectedForms = [
      'I-130', 'I-485', 'I-765', 'I-131', 'I-140',
      'I-129', 'I-539', 'N-400', 'DS-160', 'G-1145', 'I-20',
    ];
    expect(Object.keys(DEFAULT_PROCESSING_TIMES)).toEqual(expect.arrayContaining(expectedForms));
    expect(Object.keys(DEFAULT_PROCESSING_TIMES)).toHaveLength(11);
  });
});

describe('getProcessingTime', () => {
  it.each([
    ['I-130', { minDays: 365, maxDays: 730, medianDays: 547 }],
    ['I-485', { minDays: 240, maxDays: 730, medianDays: 485 }],
    ['I-765', { minDays: 90, maxDays: 180, medianDays: 135 }],
    ['I-131', { minDays: 90, maxDays: 180, medianDays: 135 }],
    ['I-140', { minDays: 180, maxDays: 365, medianDays: 272 }],
    ['I-129', { minDays: 30, maxDays: 180, medianDays: 105 }],
    ['I-539', { minDays: 120, maxDays: 365, medianDays: 242 }],
    ['N-400', { minDays: 365, maxDays: 730, medianDays: 547 }],
    ['DS-160', { minDays: 30, maxDays: 90, medianDays: 60 }],
    ['G-1145', { minDays: 0, maxDays: 0, medianDays: 0 }],
    ['I-20', { minDays: 14, maxDays: 60, medianDays: 30 }],
  ])('returns correct data for %s', (formType, expected) => {
    const result = getProcessingTime(formType);
    expect(result.minDays).toBe(expected.minDays);
    expect(result.maxDays).toBe(expected.maxDays);
    expect(result.medianDays).toBe(expected.medianDays);
  });

  it('returns default estimate for unknown form type', () => {
    const result = getProcessingTime('UNKNOWN-FORM');
    expect(result.formType).toBe('UNKNOWN-FORM');
    expect(result.minDays).toBe(90);
    expect(result.maxDays).toBe(365);
    expect(result.medianDays).toBe(180);
  });

  it('normalizes lowercase input', () => {
    const result = getProcessingTime('i-485');
    expect(result.formType).toBe('I-485');
    expect(result.minDays).toBe(240);
  });

  it('normalizes input with special characters', () => {
    const result = getProcessingTime('i-485!');
    expect(result.formType).toBe('I-485');
    expect(result.minDays).toBe(240);
  });
});

describe('formatProcessingTime', () => {
  it('returns Immediate when min and max are both 0', () => {
    const estimate = getProcessingTime('G-1145');
    expect(formatProcessingTime(estimate)).toBe('Immediate');
  });

  it('returns days format for DS-160 (unit is days)', () => {
    const estimate = getProcessingTime('DS-160');
    expect(formatProcessingTime(estimate)).toBe('30-90 days');
  });

  it('returns days format for I-20 (maxDays <= 90)', () => {
    const estimate = getProcessingTime('I-20');
    expect(formatProcessingTime(estimate)).toBe('14-60 days');
  });

  it('returns X-Y months for I-130 where min and max months differ', () => {
    const estimate = getProcessingTime('I-130');
    const result = formatProcessingTime(estimate);
    expect(result).toBe('12-24 months');
  });

  it('returns ~X months when min and max months are equal', () => {
    const estimate = {
      formType: 'TEST',
      minDays: 150,
      maxDays: 150,
      medianDays: 150,
      unit: 'months' as const,
      lastUpdated: '2026-01-01',
    };
    expect(formatProcessingTime(estimate)).toBe('~5 months');
  });
});

describe('calculateEstimatedCompletion', () => {
  it('adds correct days for a known form type (I-485)', () => {
    const filedDate = new Date('2026-01-01');
    const result = calculateEstimatedCompletion(filedDate, 'I-485');

    const expectedMin = new Date('2026-01-01');
    expectedMin.setDate(expectedMin.getDate() + 240);
    const expectedMax = new Date('2026-01-01');
    expectedMax.setDate(expectedMax.getDate() + 730);
    const expectedMedian = new Date('2026-01-01');
    expectedMedian.setDate(expectedMedian.getDate() + 485);

    expect(result.minDate.getTime()).toBe(expectedMin.getTime());
    expect(result.maxDate.getTime()).toBe(expectedMax.getTime());
    expect(result.medianDate.getTime()).toBe(expectedMedian.getTime());
  });

  it('uses default processing time for unknown form type', () => {
    const filedDate = new Date('2026-06-15');
    const result = calculateEstimatedCompletion(filedDate, 'UNKNOWN');

    const expectedMin = new Date('2026-06-15');
    expectedMin.setDate(expectedMin.getDate() + 90);
    const expectedMax = new Date('2026-06-15');
    expectedMax.setDate(expectedMax.getDate() + 365);
    const expectedMedian = new Date('2026-06-15');
    expectedMedian.setDate(expectedMedian.getDate() + 180);

    expect(result.minDate.getTime()).toBe(expectedMin.getTime());
    expect(result.maxDate.getTime()).toBe(expectedMax.getTime());
    expect(result.medianDate.getTime()).toBe(expectedMedian.getTime());
  });

  it('does not mutate the original filed date', () => {
    const filedDate = new Date('2026-03-01');
    const originalTime = filedDate.getTime();
    calculateEstimatedCompletion(filedDate, 'I-130');
    expect(filedDate.getTime()).toBe(originalTime);
  });
});
