import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// UUID constants
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockAttorneyProfile = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
  role: 'attorney',
  first_name: 'Attorney',
  last_name: 'User',
  phone: null,
  mfa_enabled: false,
  primary_firm_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: ATTORNEY_ID, email: 'attorney@example.com' } },
      error: null,
    }),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn().mockImplementation((userId: string) => {
    if (userId === ATTORNEY_ID) {
      return Promise.resolve({ profile: mockAttorneyProfile, error: null });
    }
    return Promise.resolve({ profile: null, error: new Error('Profile not found') });
  }),
  getAdminClient: vi.fn(),
}));

// Mock deadline service
const mockGetUpcomingDeadlines = vi.fn();
vi.mock('@/lib/deadline', () => ({
  getUpcomingDeadlines: (...args: unknown[]) => mockGetUpcomingDeadlines(...args),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AI_COMPLETENESS: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-completeness' },
    AI_SUCCESS_SCORE: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-success-score' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
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
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
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

describe('GET /api/cases/deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: ATTORNEY_ID, email: 'attorney@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated user', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 200 with deadlines grouped by severity', async () => {
    const mockDeadlines = [
      { id: '1', severity: 'critical', acknowledged: false, title: 'Filing deadline' },
      { id: '2', severity: 'warning', acknowledged: false, title: 'Document expiry' },
      { id: '3', severity: 'info', acknowledged: false, title: 'Reminder' },
      { id: '4', severity: 'critical', acknowledged: true, title: 'Past deadline' },
    ];
    mockGetUpcomingDeadlines.mockResolvedValue(mockDeadlines);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    const data = json.data;
    expect(data.summary.total).toBe(4);
    expect(data.summary.critical).toBe(1);
    expect(data.summary.warning).toBe(1);
    expect(data.summary.info).toBe(1);
    expect(data.summary.acknowledged).toBe(1);
    expect(data.grouped.critical).toHaveLength(1);
    expect(data.grouped.warning).toHaveLength(1);
    expect(data.grouped.info).toHaveLength(1);
    expect(data.grouped.acknowledged).toHaveLength(1);
  });

  it('should use default 60 days when no days param provided', async () => {
    mockGetUpcomingDeadlines.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines');
    await GET(request);

    expect(mockGetUpcomingDeadlines).toHaveBeenCalledWith(ATTORNEY_ID, 60);
  });

  it('should pass custom days parameter', async () => {
    mockGetUpcomingDeadlines.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines?days=30');
    await GET(request);

    expect(mockGetUpcomingDeadlines).toHaveBeenCalledWith(ATTORNEY_ID, 30);
  });

  it('should clamp days param to minimum of 1', async () => {
    mockGetUpcomingDeadlines.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines?days=0');
    await GET(request);

    expect(mockGetUpcomingDeadlines).toHaveBeenCalledWith(ATTORNEY_ID, 1);
  });

  it('should clamp days param to maximum of 365', async () => {
    mockGetUpcomingDeadlines.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines?days=999');
    await GET(request);

    expect(mockGetUpcomingDeadlines).toHaveBeenCalledWith(ATTORNEY_ID, 365);
  });

  it('should return 500 when getUpcomingDeadlines throws', async () => {
    mockGetUpcomingDeadlines.mockRejectedValue(new Error('Database error'));

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it('should return empty groupings when no deadlines exist', async () => {
    mockGetUpcomingDeadlines.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = createMockRequest('http://localhost:3000/api/cases/deadlines');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    const data = json.data;
    expect(data.summary.total).toBe(0);
    expect(data.summary.critical).toBe(0);
    expect(data.grouped.critical).toHaveLength(0);
    expect(data.grouped.warning).toHaveLength(0);
    expect(data.grouped.info).toHaveLength(0);
    expect(data.grouped.acknowledged).toHaveLength(0);
  });
});
