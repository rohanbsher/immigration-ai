import { describe, it, expect } from 'vitest';
import {
  PLAN_FEATURES,
  getPlanDetails,
  formatLimit,
  formatStorage,
  formatPrice,
  isUnlimited,
  getYearlySavings,
} from './limits';

describe('PLAN_FEATURES', () => {
  it('has free, pro, and enterprise plans', () => {
    expect(PLAN_FEATURES).toHaveProperty('free');
    expect(PLAN_FEATURES).toHaveProperty('pro');
    expect(PLAN_FEATURES).toHaveProperty('enterprise');
  });

  it('each plan has name, description, price, limits, and features', () => {
    for (const plan of Object.values(PLAN_FEATURES)) {
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('description');
      expect(plan).toHaveProperty('price');
      expect(plan.price).toHaveProperty('monthly');
      expect(plan.price).toHaveProperty('yearly');
      expect(plan).toHaveProperty('limits');
      expect(plan).toHaveProperty('features');
    }
  });
});

describe('getPlanDetails', () => {
  it('returns free plan details', () => {
    const plan = getPlanDetails('free');
    expect(plan.name).toBe('Free');
    expect(plan.price.monthly).toBe(0);
  });

  it('returns pro plan details', () => {
    const plan = getPlanDetails('pro');
    expect(plan.name).toBe('Pro');
    expect(plan.price.monthly).toBe(99);
  });

  it('returns enterprise plan details', () => {
    const plan = getPlanDetails('enterprise');
    expect(plan.name).toBe('Enterprise');
    expect(plan.price.monthly).toBe(299);
  });

  it('falls back to free plan for unknown plan type', () => {
    const plan = getPlanDetails('unknown' as 'free');
    expect(plan.name).toBe('Free');
    expect(plan.price.monthly).toBe(0);
  });
});

describe('formatLimit', () => {
  it('returns Unlimited for -1', () => {
    expect(formatLimit(-1)).toBe('Unlimited');
  });

  it('returns 0 for 0', () => {
    expect(formatLimit(0)).toBe('0');
  });

  it('returns formatted number for 50', () => {
    expect(formatLimit(50)).toBe('50');
  });

  it('returns formatted number for 500', () => {
    expect(formatLimit(500)).toBe('500');
  });

  it('formats numbers >= 1000 with locale separators', () => {
    // toLocaleString() adds separators in most locales
    const result = formatLimit(1000);
    expect(result).toBe(Number(1000).toLocaleString());
  });

  it('formats large numbers', () => {
    const result = formatLimit(10000);
    expect(result).toBe(Number(10000).toLocaleString());
  });
});

describe('formatStorage', () => {
  it('returns GB for values under 1000', () => {
    expect(formatStorage(1)).toBe('1 GB');
  });

  it('returns GB for 25', () => {
    expect(formatStorage(25)).toBe('25 GB');
  });

  it('returns GB for 500', () => {
    expect(formatStorage(500)).toBe('500 GB');
  });

  it('returns TB for 1000', () => {
    expect(formatStorage(1000)).toBe('1 TB');
  });
});

describe('formatPrice', () => {
  it('returns Free for amount 0 with monthly period', () => {
    expect(formatPrice(0, 'monthly')).toBe('Free');
  });

  it('returns Free for amount 0 with yearly period', () => {
    expect(formatPrice(0, 'yearly')).toBe('Free');
  });

  it('returns $X/mo for monthly pricing', () => {
    expect(formatPrice(99, 'monthly')).toBe('$99/mo');
  });

  it('returns $X/mo (billed yearly) for yearly pricing', () => {
    expect(formatPrice(79, 'yearly')).toBe('$79/mo (billed yearly)');
  });
});

describe('isUnlimited', () => {
  it('returns true for -1', () => {
    expect(isUnlimited(-1)).toBe(true);
  });

  it('returns false for 0', () => {
    expect(isUnlimited(0)).toBe(false);
  });

  it('returns false for 50', () => {
    expect(isUnlimited(50)).toBe(false);
  });
});

describe('getYearlySavings', () => {
  it('returns 0 for free plan', () => {
    expect(getYearlySavings('free')).toBe(0);
  });

  it('returns 240 for pro plan ((99-79)*12)', () => {
    expect(getYearlySavings('pro')).toBe(240);
  });

  it('returns 600 for enterprise plan ((299-249)*12)', () => {
    expect(getYearlySavings('enterprise')).toBe(600);
  });

  it('returns 0 for unknown plan type', () => {
    expect(getYearlySavings('unknown' as 'free')).toBe(0);
  });
});
