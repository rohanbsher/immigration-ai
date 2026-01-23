import {
  PLAN_FEATURES,
  getPlanDetails,
  formatLimit,
  formatStorage,
  formatPrice,
  isUnlimited,
  getYearlySavings,
} from '@/lib/billing/limits';

describe('Billing Limits', () => {
  describe('PLAN_FEATURES', () => {
    it('should have free, pro, and enterprise plans', () => {
      expect(PLAN_FEATURES).toHaveProperty('free');
      expect(PLAN_FEATURES).toHaveProperty('pro');
      expect(PLAN_FEATURES).toHaveProperty('enterprise');
    });

    it('should have free plan with 0 price', () => {
      expect(PLAN_FEATURES.free.price.monthly).toBe(0);
      expect(PLAN_FEATURES.free.price.yearly).toBe(0);
    });

    it('should have proper limits for free plan', () => {
      expect(PLAN_FEATURES.free.limits.maxCases).toBe(3);
      expect(PLAN_FEATURES.free.limits.maxTeamMembers).toBe(1);
    });

    it('should have enterprise with unlimited features (-1)', () => {
      expect(PLAN_FEATURES.enterprise.limits.maxCases).toBe(-1);
      expect(PLAN_FEATURES.enterprise.limits.maxDocumentsPerCase).toBe(-1);
    });
  });

  describe('getPlanDetails', () => {
    it('should return free plan for "free"', () => {
      const details = getPlanDetails('free');
      expect(details.name).toBe('Free');
    });

    it('should return pro plan for "pro"', () => {
      const details = getPlanDetails('pro');
      expect(details.name).toBe('Pro');
      expect(details.price.monthly).toBe(99);
    });

    it('should return enterprise plan for "enterprise"', () => {
      const details = getPlanDetails('enterprise');
      expect(details.name).toBe('Enterprise');
    });

    it('should default to free for unknown plans', () => {
      const details = getPlanDetails('unknown' as 'free');
      expect(details.name).toBe('Free');
    });
  });

  describe('formatLimit', () => {
    it('should return "Unlimited" for -1', () => {
      expect(formatLimit(-1)).toBe('Unlimited');
    });

    it('should format numbers with locale string', () => {
      expect(formatLimit(1000)).toBe('1,000');
      expect(formatLimit(50)).toBe('50');
    });

    it('should handle 0', () => {
      expect(formatLimit(0)).toBe('0');
    });
  });

  describe('formatStorage', () => {
    it('should format GB values', () => {
      expect(formatStorage(25)).toBe('25 GB');
      expect(formatStorage(500)).toBe('500 GB');
    });

    it('should convert to TB for 1000+ GB', () => {
      expect(formatStorage(1000)).toBe('1 TB');
      expect(formatStorage(2500)).toBe('3 TB');
    });
  });

  describe('formatPrice', () => {
    it('should return "Free" for 0 amount', () => {
      expect(formatPrice(0, 'monthly')).toBe('Free');
      expect(formatPrice(0, 'yearly')).toBe('Free');
    });

    it('should format monthly price', () => {
      expect(formatPrice(99, 'monthly')).toBe('$99/mo');
    });

    it('should format yearly price', () => {
      expect(formatPrice(79, 'yearly')).toBe('$79/mo (billed yearly)');
    });
  });

  describe('isUnlimited', () => {
    it('should return true for -1', () => {
      expect(isUnlimited(-1)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isUnlimited(0)).toBe(false);
      expect(isUnlimited(50)).toBe(false);
      expect(isUnlimited(100)).toBe(false);
    });
  });

  describe('getYearlySavings', () => {
    it('should return 0 for free plan', () => {
      expect(getYearlySavings('free')).toBe(0);
    });

    it('should calculate yearly savings for pro plan', () => {
      // Pro: $99/mo monthly vs $79/mo yearly
      // Savings = (99 - 79) * 12 = $240
      expect(getYearlySavings('pro')).toBe(240);
    });

    it('should calculate yearly savings for enterprise plan', () => {
      // Enterprise: $299/mo monthly vs $249/mo yearly
      // Savings = (299 - 249) * 12 = $600
      expect(getYearlySavings('enterprise')).toBe(600);
    });
  });
});
