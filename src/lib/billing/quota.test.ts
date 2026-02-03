import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkQuota, enforceQuota, QuotaExceededError } from './quota';
import { createClient } from '@/lib/supabase/server';
import { getUserPlanLimits } from '@/lib/db/subscriptions';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/db/subscriptions', () => ({
  getUserPlanLimits: vi.fn(),
}));

/**
 * Quota Tests
 *
 * These tests verify the actual checkQuota() function logic,
 * including limit enforcement across different plans and metrics.
 */
describe('checkQuota', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock Supabase client
    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
  });

  describe('cases quota', () => {
    it('returns allowed=true when under limit', async () => {
      // Free plan: 5 cases max, user has 3
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 5,
        maxDocumentsPerCase: 100,
        maxAiRequestsPerMonth: 50,
        maxStorageGb: 5,
        maxTeamMembers: 2,
        features: {
          documentAnalysis: true,
          formAutofill: false,
          prioritySupport: false,
          apiAccess: false,
        },
      });

      // Mock current usage: 3 cases
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(2);
      expect(result.isUnlimited).toBe(false);
    });

    it('returns allowed=false when at limit', async () => {
      // Free plan: 5 cases max, user has 5
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 5,
        maxDocumentsPerCase: 100,
        maxAiRequestsPerMonth: 50,
        maxStorageGb: 5,
        maxTeamMembers: 2,
        features: {
          documentAnalysis: true,
          formAutofill: false,
          prioritySupport: false,
          apiAccess: false,
        },
      });

      // Mock current usage: 5 cases
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('limit');
    });

    it('returns allowed=false when over limit', async () => {
      // Free plan: 5 cases max, user has 6 (shouldn't happen, but edge case)
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 5,
        maxDocumentsPerCase: 100,
        maxAiRequestsPerMonth: 50,
        maxStorageGb: 5,
        maxTeamMembers: 2,
        features: {
          documentAnalysis: true,
          formAutofill: false,
          prioritySupport: false,
          apiAccess: false,
        },
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 6,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('plan-specific limits', () => {
    it('applies correct limits for pro plan', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'pro',
        maxCases: 50,
        maxDocumentsPerCase: 1000,
        maxAiRequestsPerMonth: 500,
        maxStorageGb: 50,
        maxTeamMembers: 10,
        features: {
          documentAnalysis: true,
          formAutofill: true,
          prioritySupport: true,
          apiAccess: true,
        },
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 25,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(25);
    });

    it('applies correct limits for enterprise plan', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'enterprise',
        maxCases: 1000,
        maxDocumentsPerCase: 10000,
        maxAiRequestsPerMonth: 5000,
        maxStorageGb: 500,
        maxTeamMembers: 100,
        features: {
          documentAnalysis: true,
          formAutofill: true,
          prioritySupport: true,
          apiAccess: true,
        },
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 500,
              error: null,
            }),
          }),
        }),
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(500);
    });
  });

  describe('unlimited plans', () => {
    it('returns isUnlimited=true for unlimited limits', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'enterprise',
        maxCases: -1, // -1 indicates unlimited
        maxDocumentsPerCase: -1,
        maxAiRequestsPerMonth: -1,
        maxStorageGb: -1,
        maxTeamMembers: -1,
        features: {
          documentAnalysis: true,
          formAutofill: true,
          prioritySupport: true,
          apiAccess: true,
        },
      });

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.isUnlimited).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });
  });

  describe('required amount', () => {
    it('checks against required amount when specified', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 5,
        maxDocumentsPerCase: 100,
        maxAiRequestsPerMonth: 50,
        maxStorageGb: 5,
        maxTeamMembers: 2,
        features: {
          documentAnalysis: true,
          formAutofill: false,
          prioritySupport: false,
          apiAccess: false,
        },
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 4,
              error: null,
            }),
          }),
        }),
      });

      // User has 4 cases, limit is 5, trying to add 2 more
      const result = await checkQuota('user-123', 'cases', 2);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(4);
      expect(result.limit).toBe(5);
    });

    it('allows when required amount fits within remaining', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue({
        planType: 'free',
        maxCases: 5,
        maxDocumentsPerCase: 100,
        maxAiRequestsPerMonth: 50,
        maxStorageGb: 5,
        maxTeamMembers: 2,
        features: {
          documentAnalysis: true,
          formAutofill: false,
          prioritySupport: false,
          apiAccess: false,
        },
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        }),
      });

      // User has 3 cases, limit is 5, trying to add 2 more
      const result = await checkQuota('user-123', 'cases', 2);

      expect(result.allowed).toBe(true);
    });
  });
});

describe('enforceQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
  });

  it('throws QuotaExceededError when quota exceeded', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue({
      planType: 'free',
      maxCases: 5,
      maxDocumentsPerCase: 100,
      maxAiRequestsPerMonth: 50,
      maxStorageGb: 5,
      maxTeamMembers: 2,
      features: {
        documentAnalysis: true,
        formAutofill: false,
        prioritySupport: false,
        apiAccess: false,
      },
    });

    await expect(enforceQuota('user-123', 'cases')).rejects.toThrow(QuotaExceededError);
    await expect(enforceQuota('user-123', 'cases')).rejects.toMatchObject({
      metric: 'cases',
      limit: 5,
      current: 5,
    });
  });

  it('does not throw when under quota', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue({
      planType: 'pro',
      maxCases: 50,
      maxDocumentsPerCase: 1000,
      maxAiRequestsPerMonth: 500,
      maxStorageGb: 50,
      maxTeamMembers: 10,
      features: {
        documentAnalysis: true,
        formAutofill: true,
        prioritySupport: true,
        apiAccess: true,
      },
    });

    await expect(enforceQuota('user-123', 'cases')).resolves.not.toThrow();
  });
});

describe('QuotaExceededError', () => {
  it('includes metric, limit, and current in error', () => {
    const error = new QuotaExceededError('cases', 5, 5);

    expect(error.name).toBe('QuotaExceededError');
    expect(error.metric).toBe('cases');
    expect(error.limit).toBe(5);
    expect(error.current).toBe(5);
    expect(error.message).toContain('cases');
    expect(error.message).toContain('5/5');
  });

  it('is instanceof Error', () => {
    const error = new QuotaExceededError('documents', 100, 100);
    expect(error).toBeInstanceOf(Error);
  });
});
