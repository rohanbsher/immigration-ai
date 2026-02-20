import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// UUID constants
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockIs = vi.fn().mockReturnValue({ single: mockSingle });
const mockEq = vi.fn().mockReturnValue({ is: mockIs });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: vi.fn().mockReturnValue({ select: mockSelect }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock AI analysis
const mockAnalyzeDocumentCompleteness = vi.fn();
vi.mock('@/lib/ai/document-completeness', () => ({
  analyzeDocumentCompleteness: (...args: unknown[]) => mockAnalyzeDocumentCompleteness(...args),
}));

// Mock requireAiConsent
const mockRequireAiConsent = vi.fn();
vi.mock('@/lib/auth/api-helpers', () => ({
  requireAiConsent: (...args: unknown[]) => mockRequireAiConsent(...args),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  features: { workerEnabled: false },
}));

// Mock job queues
vi.mock('@/lib/jobs/queues', () => ({
  enqueueCompleteness: vi.fn(),
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
vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    AI_COMPLETENESS: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-completeness' },
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AI_SUCCESS_SCORE: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-success-score' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
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

function setCaseAccessResult(caseData: { id: string; attorney_id: string; client_id: string } | null) {
  mockSingle.mockResolvedValue(
    caseData
      ? { data: caseData, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'Not found' } }
  );
}

describe('GET /api/cases/[id]/completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: authenticated as attorney, consent granted, case exists
    setAuthenticatedUser(ATTORNEY_ID);
    mockRequireAiConsent.mockResolvedValue(null);
    setCaseAccessResult({ id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated user', async () => {
    setUnauthenticated();

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when case is not found', async () => {
    setCaseAccessResult(null);

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Not Found');
  });

  it('should return 403 when user is neither attorney nor client', async () => {
    setAuthenticatedUser(OTHER_USER_ID);
    setCaseAccessResult({ id: CASE_ID, attorney_id: ATTORNEY_ID, client_id: CLIENT_ID });

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Forbidden');
  });

  it('should return 200 with completeness data for attorney', async () => {
    const mockResult = {
      overallCompleteness: 75,
      filingReadiness: 'partial',
      missingRequired: ['birth_certificate'],
      missingOptional: [],
      uploadedDocs: ['passport'],
      recommendations: ['Upload birth certificate'],
      totalRequired: 4,
      uploadedRequired: 3,
      analyzedAt: '2024-01-01T00:00:00Z',
    };
    mockAnalyzeDocumentCompleteness.mockResolvedValue(mockResult);

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.overallCompleteness).toBe(75);
    expect(data.filingReadiness).toBe('partial');
    expect(mockAnalyzeDocumentCompleteness).toHaveBeenCalledWith(CASE_ID);
  });

  it('should return 200 with completeness data for client', async () => {
    setAuthenticatedUser(CLIENT_ID);
    mockAnalyzeDocumentCompleteness.mockResolvedValue({
      overallCompleteness: 50,
      filingReadiness: 'incomplete',
      missingRequired: [],
      missingOptional: [],
      uploadedDocs: [],
      recommendations: [],
      totalRequired: 0,
      uploadedRequired: 0,
      analyzedAt: '2024-01-01T00:00:00Z',
    });

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.overallCompleteness).toBe(50);
  });

  it('should return degraded result when AI analysis fails', async () => {
    mockAnalyzeDocumentCompleteness.mockRejectedValue(new Error('AI service unavailable'));

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.degraded).toBe(true);
    expect(data.overallCompleteness).toBe(0);
    expect(data.filingReadiness).toBe('incomplete');
  });

  it('should return 404 when AI throws Case not found', async () => {
    mockAnalyzeDocumentCompleteness.mockRejectedValue(new Error('Case not found'));

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Not Found');
  });

  it('should return degraded result on unexpected top-level error', async () => {
    // Force the whole handler to throw by making getUser throw
    mockGetUser.mockRejectedValue(new Error('Unexpected error'));

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.degraded).toBe(true);
    expect(data.overallCompleteness).toBe(0);
  });

  it('should track usage on sync path', async () => {
    mockAnalyzeDocumentCompleteness.mockResolvedValue({
      overallCompleteness: 100,
      filingReadiness: 'ready',
      missingRequired: [],
      missingOptional: [],
      uploadedDocs: [],
      recommendations: [],
      totalRequired: 0,
      uploadedRequired: 0,
      analyzedAt: '2024-01-01T00:00:00Z',
    });

    const { GET } = await import('./route');
    const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/completeness`);
    await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

    expect(mockTrackUsage).toHaveBeenCalledWith(ATTORNEY_ID, 'ai_requests');
  });
});
