import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkQuota,
  enforceQuota,
  enforceQuotaForCase,
  trackUsage,
  QuotaExceededError,
  POSTGREST_NO_ROWS,
} from './quota';
import { createClient } from '@/lib/supabase/server';
import { getUserPlanLimits } from '@/lib/db/subscriptions';
import { createMockPlanLimits } from '@/test-utils/factories';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/db/subscriptions', () => ({
  getUserPlanLimits: vi.fn(),
}));

// Mock logger - we'll access this via the module mock
vi.mock('@/lib/logger', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  };
  return {
    createLogger: vi.fn().mockReturnValue(mockLogger),
    __mockLogger: mockLogger,
  };
});

// Import the mock logger for test assertions
import { __mockLogger as mockLogger } from '@/lib/logger';

describe('checkQuota', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  describe('cases quota', () => {
    it('returns allowed=true when under limit', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

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
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

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
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

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

  describe('documents quota (per-case semantics)', () => {
    it('returns max documents in any single case', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

      const mockCases = [{ id: 'case-1' }, { id: 'case-2' }];
      const mockDocs = [
        { case_id: 'case-1' },
        { case_id: 'case-1' },
        { case_id: 'case-1' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
        { case_id: 'case-2' },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: mockCases,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: mockDocs,
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await checkQuota('user-123', 'documents');

      expect(result.current).toBe(7);
      expect(result.limit).toBe(10);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('returns 0 when user has no cases', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await checkQuota('user-123', 'documents');

      expect(result.current).toBe(0);
      expect(result.allowed).toBe(true);
    });

    it('returns 0 when cases have no documents', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: 'case-1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const result = await checkQuota('user-123', 'documents');

      expect(result.current).toBe(0);
      expect(result.allowed).toBe(true);
    });
  });

  describe('plan-specific limits', () => {
    it('applies correct limits for pro plan', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('pro'));

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
      vi.mocked(getUserPlanLimits).mockResolvedValue(
        createMockPlanLimits('enterprise', { maxCases: 1000 })
      );

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
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('enterprise'));

      const result = await checkQuota('user-123', 'cases');

      expect(result.allowed).toBe(true);
      expect(result.isUnlimited).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });
  });

  describe('required amount', () => {
    it('checks against required amount when specified', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

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

      const result = await checkQuota('user-123', 'cases', 2);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(4);
      expect(result.limit).toBe(5);
    });

    it('allows when required amount fits within remaining', async () => {
      vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

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

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  it('throws QuotaExceededError when quota exceeded', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    await expect(enforceQuota('user-123', 'cases')).rejects.toThrow(QuotaExceededError);
    await expect(enforceQuota('user-123', 'cases')).rejects.toMatchObject({
      metric: 'cases',
      limit: 5,
      current: 5,
    });
  });

  it('does not throw when under quota', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('pro'));

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

describe('enforceQuotaForCase', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  it('throws QuotaExceededError when case document limit exceeded', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { attorney_id: 'user-123' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                count: 10,
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    await expect(enforceQuotaForCase('case-1', 'documents')).rejects.toThrow(QuotaExceededError);
    await expect(enforceQuotaForCase('case-1', 'documents')).rejects.toMatchObject({
      metric: 'documents',
      limit: 10,
      current: 10,
    });
  });

  it('does not throw when under case document limit', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { attorney_id: 'user-123' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                count: 5,
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    await expect(enforceQuotaForCase('case-1', 'documents')).resolves.not.toThrow();
  });

  it('does not throw when plan has unlimited documents', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { attorney_id: 'user-123' },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('enterprise'));

    await expect(enforceQuotaForCase('case-1', 'documents')).resolves.not.toThrow();
  });

  it('throws Error when case not found', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: POSTGREST_NO_ROWS, message: 'Not found' },
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    await expect(enforceQuotaForCase('case-nonexistent', 'documents')).rejects.toThrow('Case not found');
  });

  it('throws with error message when case query fails', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'SOME_ERROR', message: 'Connection failed' },
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    await expect(enforceQuotaForCase('case-1', 'documents')).rejects.toThrow('Failed to get case: Connection failed');
  });

  it('skips case lookup when attorneyId is provided', async () => {
    let casesTableQueried = false;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        casesTableQueried = true;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Should not be called' },
              }),
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                count: 5,
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    await expect(enforceQuotaForCase('case-1', 'documents', 'user-123')).resolves.not.toThrow();
    expect(casesTableQueried).toBe(false);
  });
});

describe('getCurrentUsage error handling', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  it('throws when cases query fails in documents metric', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection failed' },
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    await expect(checkQuota('user-123', 'documents')).rejects.toThrow(
      'Failed to get user cases: Connection failed'
    );
  });

  it('throws when documents query fails in documents metric', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: [{ id: 'case-1' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query timeout' },
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    await expect(checkQuota('user-123', 'documents')).rejects.toThrow(
      'Failed to get document counts: Query timeout'
    );
  });

  it('throws when cases count query fails', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({
            count: null,
            error: { message: 'Database error' },
          }),
        }),
      }),
    });

    await expect(checkQuota('user-123', 'cases')).rejects.toThrow(
      'Failed to get case count: Database error'
    );
  });

  it('throws when storage query fails', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage query failed' },
        }),
      }),
    });

    await expect(checkQuota('user-123', 'storage')).rejects.toThrow(
      'Failed to get storage usage: Storage query failed'
    );
  });

  it('throws when team_members query fails', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          count: null,
          error: { message: 'Team query failed' },
        }),
      }),
    });

    await expect(checkQuota('user-123', 'team_members')).rejects.toThrow(
      'Failed to get team member count: Team query failed'
    );
  });

  it('throws when ai_requests subscription query fails (non-PGRST116)', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('pro'));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'OTHER_ERROR', message: 'Connection lost' },
            }),
          }),
        }),
      }),
    });

    await expect(checkQuota('user-123', 'ai_requests')).rejects.toThrow(
      'Failed to get subscription: Connection lost'
    );
  });

  it('does NOT throw when subscription not found (PGRST116)', async () => {
    vi.mocked(getUserPlanLimits).mockResolvedValue(createMockPlanLimits('free'));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: POSTGREST_NO_ROWS, message: 'No rows found' },
            }),
          }),
        }),
      }),
    });

    const result = await checkQuota('user-123', 'ai_requests');

    expect(result.current).toBe(0);
    expect(result.allowed).toBe(true);
  });
});

describe('POSTGREST_NO_ROWS constant', () => {
  it('is exported and has correct value', () => {
    expect(POSTGREST_NO_ROWS).toBe('PGRST116');
  });
});

describe('trackUsage', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  it('increments usage when subscription found', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                current_period_start: '2024-01-01',
                current_period_end: '2024-02-01',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });

    await trackUsage('user-123', 'ai_requests', 5);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_usage', {
      p_subscription_id: 'sub-123',
      p_metric_name: 'ai_requests',
      p_quantity: 5,
    });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('returns silently when no subscription found (PGRST116)', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: POSTGREST_NO_ROWS, message: 'No rows found' },
            }),
          }),
        }),
      }),
    });

    await trackUsage('user-123', 'ai_requests');

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('logs warning when subscription query fails (non-PGRST116)', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'OTHER_ERROR', message: 'Connection failed' },
            }),
          }),
        }),
      }),
    });

    await trackUsage('user-123', 'ai_requests');

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to get subscription for usage tracking',
      expect.objectContaining({
        userId: 'user-123',
        metric: 'ai_requests',
        error: 'Connection failed',
      })
    );
  });

  it('logs warning when RPC fails', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                current_period_start: '2024-01-01',
                current_period_end: '2024-02-01',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.rpc.mockResolvedValue({ error: { message: 'RPC failed' } });

    await trackUsage('user-123', 'ai_requests');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to increment usage',
      expect.objectContaining({
        userId: 'user-123',
        metric: 'ai_requests',
        subscriptionId: 'sub-123',
        error: 'RPC failed',
      })
    );
  });

  it('logs warning on unexpected error and does not throw', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('Unexpected DB error'));

    await expect(trackUsage('user-123', 'ai_requests')).resolves.not.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unexpected error in trackUsage',
      expect.objectContaining({
        userId: 'user-123',
        metric: 'ai_requests',
        error: 'Unexpected DB error',
      })
    );
  });

  it('defaults amount to 1 when not specified', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'sub-123',
                current_period_start: '2024-01-01',
                current_period_end: '2024-02-01',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });

    await trackUsage('user-123', 'ai_requests');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_usage', {
      p_subscription_id: 'sub-123',
      p_metric_name: 'ai_requests',
      p_quantity: 1,
    });
  });
});
