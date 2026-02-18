import { describe, it, expect, vi } from 'vitest';
import type { PlanType } from '@/lib/db/subscriptions';

// Tests for the limits module - these are pure functions that don't need mocking
import {
  PLAN_FEATURES,
  getPlanDetails,
  formatLimit,
  formatStorage,
  formatPrice,
  isUnlimited,
  getYearlySavings,
} from './limits';

// Test QuotaExceededError directly
import { QuotaExceededError } from './quota';

describe('Billing - Limits Module', () => {
  describe('PLAN_FEATURES', () => {
    it('should have free plan with correct limits', () => {
      expect(PLAN_FEATURES.free.name).toBe('Free');
      expect(PLAN_FEATURES.free.price.monthly).toBe(0);
      expect(PLAN_FEATURES.free.price.yearly).toBe(0);
      expect(PLAN_FEATURES.free.limits.maxCases).toBe(100);
      expect(PLAN_FEATURES.free.limits.maxDocumentsPerCase).toBe(50);
      expect(PLAN_FEATURES.free.limits.maxAiRequestsPerMonth).toBe(1000);
      expect(PLAN_FEATURES.free.limits.maxStorageGb).toBe(25);
      expect(PLAN_FEATURES.free.limits.maxTeamMembers).toBe(5);
    });

    it('should have pro plan with correct limits', () => {
      expect(PLAN_FEATURES.pro.name).toBe('Pro');
      expect(PLAN_FEATURES.pro.price.monthly).toBe(99);
      expect(PLAN_FEATURES.pro.price.yearly).toBe(79);
      expect(PLAN_FEATURES.pro.limits.maxCases).toBe(250);
      expect(PLAN_FEATURES.pro.limits.maxDocumentsPerCase).toBe(100);
      expect(PLAN_FEATURES.pro.limits.maxAiRequestsPerMonth).toBe(2500);
      expect(PLAN_FEATURES.pro.limits.maxStorageGb).toBe(50);
      expect(PLAN_FEATURES.pro.limits.maxTeamMembers).toBe(10);
    });

    it('should have enterprise plan with unlimited options', () => {
      expect(PLAN_FEATURES.enterprise.name).toBe('Enterprise');
      expect(PLAN_FEATURES.enterprise.price.monthly).toBe(299);
      expect(PLAN_FEATURES.enterprise.price.yearly).toBe(249);
      expect(PLAN_FEATURES.enterprise.limits.maxCases).toBe(-1);
      expect(PLAN_FEATURES.enterprise.limits.maxDocumentsPerCase).toBe(-1);
      expect(PLAN_FEATURES.enterprise.limits.maxAiRequestsPerMonth).toBe(-1);
      expect(PLAN_FEATURES.enterprise.limits.maxStorageGb).toBe(500);
      expect(PLAN_FEATURES.enterprise.limits.maxTeamMembers).toBe(-1);
    });

    it('should have correct features for each plan', () => {
      // Free plan features (early access — most features enabled)
      expect(PLAN_FEATURES.free.features.documentAnalysis).toBe(true);
      expect(PLAN_FEATURES.free.features.formAutofill).toBe(true);
      expect(PLAN_FEATURES.free.features.prioritySupport).toBe(false);
      expect(PLAN_FEATURES.free.features.apiAccess).toBe(false);
      expect(PLAN_FEATURES.free.features.teamCollaboration).toBe(true);
      expect(PLAN_FEATURES.free.features.customBranding).toBe(false);
      expect(PLAN_FEATURES.free.features.advancedReporting).toBe(true);

      // Pro plan features
      expect(PLAN_FEATURES.pro.features.documentAnalysis).toBe(true);
      expect(PLAN_FEATURES.pro.features.formAutofill).toBe(true);
      expect(PLAN_FEATURES.pro.features.prioritySupport).toBe(true);
      expect(PLAN_FEATURES.pro.features.apiAccess).toBe(false);
      expect(PLAN_FEATURES.pro.features.teamCollaboration).toBe(true);
      expect(PLAN_FEATURES.pro.features.customBranding).toBe(false);
      expect(PLAN_FEATURES.pro.features.advancedReporting).toBe(true);

      // Enterprise plan features
      expect(PLAN_FEATURES.enterprise.features.documentAnalysis).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.formAutofill).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.prioritySupport).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.apiAccess).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.teamCollaboration).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.customBranding).toBe(true);
      expect(PLAN_FEATURES.enterprise.features.advancedReporting).toBe(true);
    });

    it('should have descriptions for each plan', () => {
      expect(PLAN_FEATURES.free.description).toBe('Early access — all features included');
      expect(PLAN_FEATURES.pro.description).toBe('Perfect for solo practitioners');
      expect(PLAN_FEATURES.enterprise.description).toBe('For growing firms');
    });
  });

  describe('getPlanDetails', () => {
    it('should return correct details for free plan', () => {
      const details = getPlanDetails('free');
      expect(details).toEqual(PLAN_FEATURES.free);
    });

    it('should return correct details for pro plan', () => {
      const details = getPlanDetails('pro');
      expect(details).toEqual(PLAN_FEATURES.pro);
    });

    it('should return correct details for enterprise plan', () => {
      const details = getPlanDetails('enterprise');
      expect(details).toEqual(PLAN_FEATURES.enterprise);
    });

    it('should return free plan for invalid plan type', () => {
      const details = getPlanDetails('invalid' as PlanType);
      expect(details).toEqual(PLAN_FEATURES.free);
    });

    it('should return free plan for undefined plan type', () => {
      const details = getPlanDetails(undefined as unknown as PlanType);
      expect(details).toEqual(PLAN_FEATURES.free);
    });
  });

  describe('formatLimit', () => {
    it('should return "Unlimited" for -1', () => {
      expect(formatLimit(-1)).toBe('Unlimited');
    });

    it('should format small numbers without commas', () => {
      expect(formatLimit(50)).toBe('50');
      expect(formatLimit(0)).toBe('0');
      expect(formatLimit(100)).toBe('100');
      expect(formatLimit(999)).toBe('999');
    });

    it('should format large numbers with locale string', () => {
      expect(formatLimit(1000)).toBe('1,000');
      expect(formatLimit(10000)).toBe('10,000');
      expect(formatLimit(1000000)).toBe('1,000,000');
    });
  });

  describe('formatStorage', () => {
    it('should format TB for values >= 1000', () => {
      expect(formatStorage(1000)).toBe('1 TB');
      expect(formatStorage(2500)).toBe('3 TB');
      expect(formatStorage(5000)).toBe('5 TB');
    });

    it('should format GB for values < 1000', () => {
      expect(formatStorage(500)).toBe('500 GB');
      expect(formatStorage(25)).toBe('25 GB');
      expect(formatStorage(1)).toBe('1 GB');
      expect(formatStorage(999)).toBe('999 GB');
    });

    it('should round TB values correctly', () => {
      expect(formatStorage(1500)).toBe('2 TB'); // 1.5 rounds to 2
      expect(formatStorage(1200)).toBe('1 TB'); // 1.2 rounds to 1
    });
  });

  describe('formatPrice', () => {
    it('should return "Free" for 0 amount', () => {
      expect(formatPrice(0, 'monthly')).toBe('Free');
      expect(formatPrice(0, 'yearly')).toBe('Free');
    });

    it('should format monthly price correctly', () => {
      expect(formatPrice(99, 'monthly')).toBe('$99/mo');
      expect(formatPrice(299, 'monthly')).toBe('$299/mo');
      expect(formatPrice(9, 'monthly')).toBe('$9/mo');
    });

    it('should format yearly price correctly', () => {
      expect(formatPrice(79, 'yearly')).toBe('$79/mo (billed yearly)');
      expect(formatPrice(249, 'yearly')).toBe('$249/mo (billed yearly)');
    });
  });

  describe('isUnlimited', () => {
    it('should return true for -1', () => {
      expect(isUnlimited(-1)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isUnlimited(0)).toBe(false);
    });

    it('should return false for positive numbers', () => {
      expect(isUnlimited(1)).toBe(false);
      expect(isUnlimited(100)).toBe(false);
      expect(isUnlimited(999999)).toBe(false);
    });

    it('should return false for negative numbers other than -1', () => {
      expect(isUnlimited(-2)).toBe(false);
      expect(isUnlimited(-100)).toBe(false);
    });
  });

  describe('getYearlySavings', () => {
    it('should return 0 for free plan', () => {
      expect(getYearlySavings('free')).toBe(0);
    });

    it('should calculate savings for pro plan', () => {
      // monthly: 99, yearly: 79
      // savings = (99 - 79) * 12 = 240
      expect(getYearlySavings('pro')).toBe(240);
    });

    it('should calculate savings for enterprise plan', () => {
      // monthly: 299, yearly: 249
      // savings = (299 - 249) * 12 = 600
      expect(getYearlySavings('enterprise')).toBe(600);
    });

    it('should return 0 for invalid plan type', () => {
      expect(getYearlySavings('invalid' as PlanType)).toBe(0);
    });
  });
});

describe('Billing - Quota Module', () => {
  describe('QuotaExceededError', () => {
    it('should create error with correct properties', () => {
      const error = new QuotaExceededError('ai_requests', 100, 100);

      expect(error.name).toBe('QuotaExceededError');
      expect(error.metric).toBe('ai_requests');
      expect(error.limit).toBe(100);
      expect(error.current).toBe(100);
      expect(error.message).toBe('Quota exceeded for ai_requests: 100/100');
    });

    it('should be an instance of Error', () => {
      const error = new QuotaExceededError('cases', 5, 5);
      expect(error).toBeInstanceOf(Error);
    });

    it('should include correct message format for different metrics', () => {
      const casesError = new QuotaExceededError('cases', 10, 10);
      expect(casesError.message).toBe('Quota exceeded for cases: 10/10');

      const storageError = new QuotaExceededError('storage', 1073741824, 1073741824);
      expect(storageError.message).toBe('Quota exceeded for storage: 1073741824/1073741824');

      const membersError = new QuotaExceededError('team_members', 5, 5);
      expect(membersError.message).toBe('Quota exceeded for team_members: 5/5');
    });

    it('should preserve stack trace', () => {
      const error = new QuotaExceededError('documents', 50, 50);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('QuotaExceededError');
    });
  });
});

describe('Billing - Plan Comparison', () => {
  it('should have progressively increasing limits from pro to enterprise', () => {
    const pro = PLAN_FEATURES.pro.limits;
    const enterprise = PLAN_FEATURES.enterprise.limits;

    // Note: Free plan has temporarily bumped limits for early access beta.
    // Progressive ordering is only guaranteed from Pro → Enterprise.

    // Cases
    expect(pro.maxCases).toBeLessThan(enterprise.maxCases === -1 ? Infinity : enterprise.maxCases);

    // Storage
    expect(pro.maxStorageGb).toBeLessThan(enterprise.maxStorageGb);
  });

  it('should have progressively increasing prices from free to enterprise', () => {
    expect(PLAN_FEATURES.free.price.monthly).toBe(0);
    expect(PLAN_FEATURES.pro.price.monthly).toBeGreaterThan(PLAN_FEATURES.free.price.monthly);
    expect(PLAN_FEATURES.enterprise.price.monthly).toBeGreaterThan(PLAN_FEATURES.pro.price.monthly);
  });

  it('should have yearly discount for paid plans', () => {
    // Pro plan yearly should be cheaper per month than monthly
    expect(PLAN_FEATURES.pro.price.yearly).toBeLessThan(PLAN_FEATURES.pro.price.monthly);

    // Enterprise plan yearly should be cheaper per month than monthly
    expect(PLAN_FEATURES.enterprise.price.yearly).toBeLessThan(PLAN_FEATURES.enterprise.price.monthly);
  });
});
