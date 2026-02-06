import { describe, it, expect } from 'vitest';
import {
  getCompletenessColor,
  getSuccessScoreColors,
  getPriorityColors,
  getSeverityColors,
  getFactorStatusInfo,
} from './status-colors';

describe('getCompletenessColor', () => {
  it('returns green for 100%', () => {
    const result = getCompletenessColor(100);
    expect(result.bg).toBe('bg-green-100');
    expect(result.text).toBe('text-green-700');
    expect(result.border).toBe('border-green-500');
    expect(result.gradient).toBe('from-green-500 to-emerald-500');
  });

  it('returns green for 90% (boundary)', () => {
    const result = getCompletenessColor(90);
    expect(result.bg).toBe('bg-green-100');
  });

  it('returns blue for 89% (just below green threshold)', () => {
    const result = getCompletenessColor(89);
    expect(result.bg).toBe('bg-blue-100');
    expect(result.text).toBe('text-blue-700');
  });

  it('returns blue for 70% (boundary)', () => {
    const result = getCompletenessColor(70);
    expect(result.bg).toBe('bg-blue-100');
  });

  it('returns yellow for 69% (just below blue threshold)', () => {
    const result = getCompletenessColor(69);
    expect(result.bg).toBe('bg-yellow-100');
    expect(result.text).toBe('text-yellow-700');
  });

  it('returns yellow for 50% (boundary)', () => {
    const result = getCompletenessColor(50);
    expect(result.bg).toBe('bg-yellow-100');
  });

  it('returns red for 49% (just below yellow threshold)', () => {
    const result = getCompletenessColor(49);
    expect(result.bg).toBe('bg-red-100');
    expect(result.text).toBe('text-red-700');
  });

  it('returns red for 0%', () => {
    const result = getCompletenessColor(0);
    expect(result.bg).toBe('bg-red-100');
    expect(result.gradient).toBe('from-red-500 to-rose-500');
  });
});

describe('getSuccessScoreColors', () => {
  it('returns green for 100', () => {
    const result = getSuccessScoreColors(100);
    expect(result.bg).toBe('bg-green-100');
    expect(result.text).toBe('text-green-700');
  });

  it('returns green for 80 (boundary)', () => {
    const result = getSuccessScoreColors(80);
    expect(result.bg).toBe('bg-green-100');
  });

  it('returns blue for 79 (just below green threshold)', () => {
    const result = getSuccessScoreColors(79);
    expect(result.bg).toBe('bg-blue-100');
    expect(result.text).toBe('text-blue-700');
  });

  it('returns blue for 60 (boundary)', () => {
    const result = getSuccessScoreColors(60);
    expect(result.bg).toBe('bg-blue-100');
  });

  it('returns yellow for 59 (just below blue threshold)', () => {
    const result = getSuccessScoreColors(59);
    expect(result.bg).toBe('bg-yellow-100');
    expect(result.text).toBe('text-yellow-700');
  });

  it('returns yellow for 40 (boundary)', () => {
    const result = getSuccessScoreColors(40);
    expect(result.bg).toBe('bg-yellow-100');
  });

  it('returns red for 39 (just below yellow threshold)', () => {
    const result = getSuccessScoreColors(39);
    expect(result.bg).toBe('bg-red-100');
    expect(result.text).toBe('text-red-700');
  });

  it('returns red for 0', () => {
    const result = getSuccessScoreColors(0);
    expect(result.bg).toBe('bg-red-100');
    expect(result.gradient).toBe('from-red-500 to-rose-500');
  });
});

describe('getPriorityColors', () => {
  it('returns red colors for critical', () => {
    const result = getPriorityColors('critical');
    expect(result.bg).toBe('bg-red-100');
    expect(result.text).toBe('text-red-700');
    expect(result.border).toBe('border-red-500');
    expect(result.icon).toBe('text-red-600');
  });

  it('returns orange colors for high', () => {
    const result = getPriorityColors('high');
    expect(result.bg).toBe('bg-orange-100');
    expect(result.text).toBe('text-orange-700');
    expect(result.border).toBe('border-orange-500');
    expect(result.icon).toBe('text-orange-600');
  });

  it('returns yellow colors for medium', () => {
    const result = getPriorityColors('medium');
    expect(result.bg).toBe('bg-yellow-100');
    expect(result.text).toBe('text-yellow-700');
    expect(result.border).toBe('border-yellow-500');
    expect(result.icon).toBe('text-yellow-600');
  });

  it('returns blue colors for low', () => {
    const result = getPriorityColors('low');
    expect(result.bg).toBe('bg-blue-100');
    expect(result.text).toBe('text-blue-700');
    expect(result.border).toBe('border-blue-500');
    expect(result.icon).toBe('text-blue-600');
  });
});

describe('getSeverityColors', () => {
  it('returns red colors for critical', () => {
    const result = getSeverityColors('critical');
    expect(result.bg).toBe('bg-red-100');
    expect(result.text).toBe('text-red-700');
    expect(result.border).toBe('border-red-500');
    expect(result.icon).toBe('text-red-600');
  });

  it('returns yellow colors for warning', () => {
    const result = getSeverityColors('warning');
    expect(result.bg).toBe('bg-yellow-100');
    expect(result.text).toBe('text-yellow-700');
    expect(result.border).toBe('border-yellow-500');
    expect(result.icon).toBe('text-yellow-600');
  });

  it('returns blue colors for info', () => {
    const result = getSeverityColors('info');
    expect(result.bg).toBe('bg-blue-100');
    expect(result.text).toBe('text-blue-700');
    expect(result.border).toBe('border-blue-500');
    expect(result.icon).toBe('text-blue-600');
  });
});

describe('getFactorStatusInfo', () => {
  it('returns check icon with green for good status', () => {
    const result = getFactorStatusInfo('good');
    expect(result.icon).toBe('check');
    expect(result.color).toBe('text-green-600');
    expect(result.bgColor).toBe('bg-green-100');
  });

  it('returns alert icon with yellow for warning status', () => {
    const result = getFactorStatusInfo('warning');
    expect(result.icon).toBe('alert');
    expect(result.color).toBe('text-yellow-600');
    expect(result.bgColor).toBe('bg-yellow-100');
  });

  it('returns x icon with red for poor status', () => {
    const result = getFactorStatusInfo('poor');
    expect(result.icon).toBe('x');
    expect(result.color).toBe('text-red-600');
    expect(result.bgColor).toBe('bg-red-100');
  });
});
