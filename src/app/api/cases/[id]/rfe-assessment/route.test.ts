import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// UUID constants
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
const INVALID_CASE_ID = 'not-a-uuid';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
// The route makes two separate from('cases') queries:
//   1. Access check:  select('id, attorney_id, client_id').eq(...).is(...).single()
//   2. Cache check:   select('rfe_assessment, rfe_assessed_at').eq(...).single()
//
// We use mockSingle to intercept both. The key is that eq() must return
// an object with both `is` (for chain 1) and `single` (for chain 2).
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockIs = vi.fn().mockReturnValue({ single: mockSingle });
const mockEq = vi.fn().mockReturnValue({ is: mockIs, single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: vi.fn().mockReturnValue({ select: mockSelect }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock assessRFERisk
const mockAssessRFERisk = vi.fn();
vi.mock('@/lib/ai/rfe', () => ({
  assessRFERisk: (...args: unknown[]) => mockAssessRFERisk(...args),
}));

// Mock requireAiConsent
const mockRequireAiConsent = vi.fn();
vi.mock('@/lib/auth/api-helpers', () => ({
  requireAiConsent: (...args: unknown[]) => mockRequireAiConsent(...args),
}));

// Mock billing quota
const mockEnforceQuota = vi.fn().mockResolvedValue(undefined);
const mockTrackUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/billing/quota', () => ({
  enforceQuota: (...args: unknown[]) => mockEnforceQuota(...args),
  trackUsage: (...args: unknown[]) => mockTrackUsage(...args),
}));

vi.mock('@/lib/billing/quota-error', () => ({
  handleQuotaError: vi.fn().mockReturnValue(null),
}));

// Mock rate limiting
const mockRateLimiter = {
  limit: vi.fn().mockResolvedValue({ allowed: true }),
};

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    AI_SUCCESS_SCORE: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-success-score' },
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AI_COMPLETENESS: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-completeness' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  createRateLimiter: vi.fn().mockReturnValue(mockRateLimiter),
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  aiRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  authRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  resetRateLimit: vi.fn(),
  clearAllRateLimits: vi.fn(),
  isRedisRateLimitingEnabled: vi.fn().mockReturnValue(false),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'GET' });
}

function setAuthenticatedUser(userId: string) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId, email: `${userId}@example.com` } },
    error: null,
  });
}

function setUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  });
}

/**
 * Set up mockSingle for the simple case: only the access check query runs.
 * Used when the request will 404/403 before reaching the cache check.
 */
function setCaseAccessResult(
  caseData: { id: string; attorney_id: string; client_id: string } | null
) {
  mockSingle.mockResolvedValue(
    caseData
      ? { data: caseData, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  );
}

/**
 * Set up mockSingle for the two-query flow:
 *   call 1 (access check) -> caseData
 *   call 2 (cache check) -> cacheData
 */
function setCaseAccessAndCache(
  caseData: { id: string; attorney_id: string; client_id: string },
  cacheData: { rfe_assessment: Record<string, unknown> | null; rfe_assessed_at: string | null }
) {
  mockSingle
    .mockResolvedValueOnce({ data: caseData, error: null })
    .mockResolvedValueOnce({ data: cacheData, error: null });
}

function createMockAssessmentResult() {
  return {
    caseId: CASE_ID,
    visaType: 'H-1B',
    rfeRiskScore: 72,
    riskLevel: 'medium' as const,
    estimatedRFEProbability: 0.28,
    triggeredRules: [
      {
        ruleId: 'h1b-specialty-degree',
        severity: 'medium' as const,
        category: 'document_content' as const,
        title: 'Specialty Degree Mismatch',
        description: 'Degree field may not align with job requirements',
        recommendation: 'Provide expert opinion letter',
        evidence: ['Degree in General Studies'],
        confidence: 0.8,
      },
    ],
    safeRuleIds: ['h1b-labor-condition', 'h1b-employer-docs'],
    priorityActions: ['Provide expert opinion letter'],
    dataConfidence: 0.5,
    assessedAt: '2026-02-20T00:00:00.000Z',
    assessmentVersion: '1.0',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cases/[id]/rfe-assessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: authenticated as attorney, consent granted, case exists
    setAuthenticatedUser(ATTORNEY_ID);
    mockRequireAiConsent.mockResolvedValue(null);
    setCaseAccessResult({ id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID });
    mockRateLimiter.limit.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe('authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      setUnauthenticated();

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('Please log in to continue');
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('should return 429 when rate limited', async () => {
      mockRateLimiter.limit.mockResolvedValueOnce({
        allowed: false,
        response: NextResponse.json(
          { error: 'Too Many Requests' },
          { status: 429 }
        ),
      });

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe('Too Many Requests');
    });
  });

  // -------------------------------------------------------------------------
  // Case access
  // -------------------------------------------------------------------------

  describe('case access', () => {
    it('should return 404 when case does not exist', async () => {
      setCaseAccessResult(null);

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('Case not found');
    });

    it('should return 403 when user is neither attorney nor client on the case', async () => {
      setAuthenticatedUser(OTHER_USER_ID);
      setCaseAccessResult({ id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID });

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(data.message).toBe('You do not have access to this case');
    });

    it('should allow the client on the case to access the assessment', async () => {
      setAuthenticatedUser(CLIENT_ID);
      const mockResult = createMockAssessmentResult();
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );
      mockAssessRFERisk.mockResolvedValue(mockResult);

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.rfeRiskScore).toBe(72);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid case ID
  // -------------------------------------------------------------------------

  describe('invalid case ID', () => {
    it('should return 404 for non-UUID case ID (Supabase rejects it)', async () => {
      setCaseAccessResult(null);

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${INVALID_CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: INVALID_CASE_ID }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not Found');
    });
  });

  // -------------------------------------------------------------------------
  // Cache hit
  // -------------------------------------------------------------------------

  describe('cache hit', () => {
    it('should return cached assessment from DB when rfe_assessment is fresh', async () => {
      const cachedAssessment = {
        caseId: CASE_ID,
        rfeRiskScore: 85,
        riskLevel: 'low',
        triggeredRules: [],
        safeRuleIds: ['h1b-labor-condition'],
        priorityActions: [],
        dataConfidence: 0.667,
        assessedAt: new Date().toISOString(),
        assessmentVersion: '1.0',
      };

      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        {
          rfe_assessment: cachedAssessment,
          rfe_assessed_at: new Date().toISOString(), // Just now, well within 1 hour
        }
      );

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.source).toBe('db-cache');
      expect(data.rfeRiskScore).toBe(85);
      expect(data.riskLevel).toBe('low');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
      // Should NOT have called the assessment engine
      expect(mockAssessRFERisk).not.toHaveBeenCalled();
    });

    it('should skip cache and run fresh assessment when cache is stale (>1 hour)', async () => {
      const staleTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const staleAssessment = {
        rfeRiskScore: 50,
        riskLevel: 'high',
        triggeredRules: [],
        safeRuleIds: [],
        priorityActions: [],
        dataConfidence: 0.3,
      };

      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        {
          rfe_assessment: staleAssessment,
          rfe_assessed_at: staleTime,
        }
      );

      const freshResult = createMockAssessmentResult();
      mockAssessRFERisk.mockResolvedValue(freshResult);

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should have the fresh result, not the stale one
      expect(data.rfeRiskScore).toBe(72);
      expect(data.source).toBeUndefined(); // Fresh results don't have source: 'db-cache'
      expect(mockAssessRFERisk).toHaveBeenCalledWith(CASE_ID, 'manual', mockSupabaseClient);
    });

    it('should bypass cache when ?refresh=true is passed', async () => {
      const freshResult = createMockAssessmentResult();
      mockAssessRFERisk.mockResolvedValue(freshResult);

      // Access check only — cache check is skipped entirely with refresh=true
      setCaseAccessResult({ id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID });

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment?refresh=true`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.rfeRiskScore).toBe(72);
      expect(mockAssessRFERisk).toHaveBeenCalledWith(CASE_ID, 'manual', mockSupabaseClient);
    });
  });

  // -------------------------------------------------------------------------
  // Cache miss (fresh assessment)
  // -------------------------------------------------------------------------

  describe('cache miss', () => {
    it('should run full assessment when cache is empty', async () => {
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );

      const mockResult = createMockAssessmentResult();
      mockAssessRFERisk.mockResolvedValue(mockResult);

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.caseId).toBe(CASE_ID);
      expect(data.visaType).toBe('H-1B');
      expect(data.rfeRiskScore).toBe(72);
      expect(data.riskLevel).toBe('medium');
      expect(data.triggeredRules).toHaveLength(1);
      expect(data.triggeredRules[0].ruleId).toBe('h1b-specialty-degree');
      expect(data.safeRuleIds).toEqual(['h1b-labor-condition', 'h1b-employer-docs']);
      expect(data.priorityActions).toEqual(['Provide expert opinion letter']);
      expect(data.dataConfidence).toBe(0.5);
      expect(data.assessmentVersion).toBe('1.0');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    });

    it('should call assessRFERisk with correct arguments', async () => {
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );

      mockAssessRFERisk.mockResolvedValue(createMockAssessmentResult());

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockAssessRFERisk).toHaveBeenCalledWith(CASE_ID, 'manual', mockSupabaseClient);
    });

    it('should enforce quota before running assessment', async () => {
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );
      mockAssessRFERisk.mockResolvedValue(createMockAssessmentResult());

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockEnforceQuota).toHaveBeenCalledWith(ATTORNEY_ID, 'ai_requests');
    });

    it('should track usage after running assessment', async () => {
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );
      mockAssessRFERisk.mockResolvedValue(createMockAssessmentResult());

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockTrackUsage).toHaveBeenCalledWith(ATTORNEY_ID, 'ai_requests');
    });
  });

  // -------------------------------------------------------------------------
  // Degraded mode
  // -------------------------------------------------------------------------

  describe('degraded mode', () => {
    it('should return degraded response when assessment engine throws', async () => {
      setCaseAccessAndCache(
        { id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID },
        { rfe_assessment: null, rfe_assessed_at: null }
      );
      mockAssessRFERisk.mockRejectedValue(new Error('Assessment engine unavailable'));

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.degraded).toBe(true);
      expect(data.rfeRiskScore).toBe(0);
      expect(data.riskLevel).toBe('low');
      expect(data.triggeredRules).toEqual([]);
      expect(data.safeRuleIds).toEqual([]);
      expect(data.priorityActions).toEqual([]);
      expect(data.dataConfidence).toBe(0);
      expect(data.assessedAt).toBeDefined();
    });

    it('should return degraded response on unexpected top-level error', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected DB crash'));

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.degraded).toBe(true);
      expect(data.rfeRiskScore).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // AI consent
  // -------------------------------------------------------------------------

  describe('AI consent', () => {
    it('should return consent error when AI consent is not granted', async () => {
      mockRequireAiConsent.mockResolvedValue(
        NextResponse.json(
          { error: 'AI consent required' },
          { status: 403 }
        )
      );

      const { GET } = await import('./route');
      const request = createMockRequest(`/api/cases/${CASE_ID}/rfe-assessment`);
      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('AI consent required');
    });
  });
});
