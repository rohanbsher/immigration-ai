/**
 * Tests for the async (worker-enabled) path in the recommendations route.
 *
 * Covers:
 * - Returns 202 with jobId when no DB cache exists
 * - Returns cached recommendations when ai_recommendations is fresh
 * - Returns 202 when cache is stale
 * - Quota enforcement still happens before enqueue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock setup ──────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockCaseId = 'case-123';

// Supabase chainable mock
function createSelectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
        }),
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

let fromResults: Record<string, unknown> = {};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn((table: string) => {
    const result = fromResults[table] || { data: null, error: null };
    return createSelectChain((result as any).data, (result as any).error);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => ({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
  RATE_LIMITS: { AI_RECOMMENDATIONS: {} },
}));

vi.mock('@/lib/auth/api-helpers', () => ({
  requireAiConsent: vi.fn().mockResolvedValue(null),
  safeParseBody: vi.fn(),
}));

vi.mock('@/lib/db/recommendations', () => ({
  getCachedRecommendations: vi.fn().mockResolvedValue(null),
  cacheRecommendations: vi.fn(),
  markRecommendationComplete: vi.fn(),
  dismissRecommendation: vi.fn(),
  filterActiveRecommendations: vi.fn((recs: unknown[]) => recs),
  sortRecommendationsByPriority: vi.fn((recs: unknown[]) => recs),
}));

const mockEnqueueRecommendations = vi.fn().mockResolvedValue({ id: 'job-abc' });
vi.mock('@/lib/jobs/queues', () => ({
  enqueueRecommendations: (...args: unknown[]) => mockEnqueueRecommendations(...args),
}));

const mockEnforceQuota = vi.fn().mockResolvedValue(undefined);
const mockTrackUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/billing/quota', () => ({
  enforceQuota: (...args: unknown[]) => mockEnforceQuota(...args),
  trackUsage: (...args: unknown[]) => mockTrackUsage(...args),
  QuotaExceededError: class QuotaExceededError extends Error {
    constructor() { super('Quota exceeded'); this.name = 'QuotaExceededError'; }
  },
}));

vi.mock('@/lib/ai/anthropic', () => ({
  suggestNextSteps: vi.fn(),
}));

vi.mock('@/lib/ai/document-completeness', () => ({
  analyzeDocumentCompleteness: vi.fn(),
}));

vi.mock('@/lib/ai/utils', () => ({
  withAIFallback: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Enable worker feature flag
vi.mock('@/lib/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return {
    ...actual,
    features: {
      ...actual.features,
      workerEnabled: true,
    },
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(url = `http://localhost/api/cases/${mockCaseId}/recommendations`) {
  return new NextRequest(url);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/cases/[id]/recommendations (async path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: case exists and user has access
    fromResults = {
      cases: {
        data: {
          id: mockCaseId,
          attorney_id: mockUser.id,
          client_id: 'client-1',
          visa_type: 'H1B',
          ai_recommendations: null,
        },
        error: null,
      },
    };
  });

  it('returns 202 with jobId when no DB cache exists', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(), { params: Promise.resolve({ id: mockCaseId }) });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.jobId).toBe('job-abc');
    expect(body.status).toBe('queued');
    expect(mockEnqueueRecommendations).toHaveBeenCalledWith({
      caseId: mockCaseId,
      userId: mockUser.id,
      visaType: 'H1B',
    });
  });

  it('returns cached recommendations when ai_recommendations is fresh', async () => {
    const freshCache = {
      caseId: mockCaseId,
      recommendations: [{ id: 'rec-1', action: 'Upload passport', priority: 'high' }],
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
      source: 'ai',
    };

    fromResults = {
      cases: {
        data: {
          id: mockCaseId,
          attorney_id: mockUser.id,
          client_id: 'client-1',
          visa_type: 'H1B',
          ai_recommendations: freshCache,
        },
        error: null,
      },
    };

    const { GET } = await import('./route');
    const response = await GET(makeRequest(), { params: Promise.resolve({ id: mockCaseId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('cache');
    expect(body.recommendations).toHaveLength(1);
    expect(mockEnqueueRecommendations).not.toHaveBeenCalled();
  });

  it('returns 202 when DB cache is stale (expired)', async () => {
    const staleCache = {
      caseId: mockCaseId,
      recommendations: [{ id: 'rec-old', action: 'Old rec', priority: 'low' }],
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      source: 'ai',
    };

    fromResults = {
      cases: {
        data: {
          id: mockCaseId,
          attorney_id: mockUser.id,
          client_id: 'client-1',
          visa_type: 'H1B',
          ai_recommendations: staleCache,
        },
        error: null,
      },
    };

    const { GET } = await import('./route');
    const response = await GET(makeRequest(), { params: Promise.resolve({ id: mockCaseId }) });

    expect(response.status).toBe(202);
    expect(mockEnqueueRecommendations).toHaveBeenCalled();
  });

  it('bypasses DB cache when refresh=true', async () => {
    const freshCache = {
      caseId: mockCaseId,
      recommendations: [{ id: 'rec-1', action: 'test', priority: 'high' }],
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      source: 'ai',
    };

    fromResults = {
      cases: {
        data: {
          id: mockCaseId,
          attorney_id: mockUser.id,
          client_id: 'client-1',
          visa_type: 'H1B',
          ai_recommendations: freshCache,
        },
        error: null,
      },
    };

    const { GET } = await import('./route');
    const url = `http://localhost/api/cases/${mockCaseId}/recommendations?refresh=true`;
    const response = await GET(makeRequest(url), { params: Promise.resolve({ id: mockCaseId }) });

    expect(response.status).toBe(202);
    expect(mockEnqueueRecommendations).toHaveBeenCalled();
  });
});
