import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
const UNAUTHORIZED_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

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

const mockClientProfile = {
  ...mockAttorneyProfile,
  id: CLIENT_ID,
  email: 'client@example.com',
  role: 'client',
  first_name: 'Client',
};

const mockActivities = [
  {
    id: 'activity-1',
    case_id: CASE_ID,
    type: 'status_change',
    description: 'Status changed to in_review',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    case_id: CASE_ID,
    type: 'document_uploaded',
    description: 'Passport uploaded',
    created_at: '2024-01-02T00:00:00Z',
  },
];

// Mock Supabase client
let mockSupabaseUser: { id: string; email: string } | null = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
};

function createChainMock(singleData: unknown = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: { user: mockSupabaseUser }, error: null })
    ),
  },
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'cases') {
      return createChainMock({
        id: CASE_ID,
        attorney_id: ATTORNEY_ID,
        client_id: CLIENT_ID,
        firm_id: null,
      });
    }
    // firm_members fallback returns null (no membership)
    return createChainMock(null);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock getProfileAsAdmin
vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn().mockImplementation((userId: string) => {
    if (userId === ATTORNEY_ID) {
      return Promise.resolve({ profile: mockAttorneyProfile, error: null });
    }
    if (userId === CLIENT_ID) {
      return Promise.resolve({ profile: mockClientProfile, error: null });
    }
    if (userId === UNAUTHORIZED_USER_ID) {
      return Promise.resolve({
        profile: { ...mockClientProfile, id: UNAUTHORIZED_USER_ID },
        error: null,
      });
    }
    return Promise.resolve({ profile: null, error: new Error('Profile not found') });
  }),
  getAdminClient: vi.fn(),
}));

// Mock db services
const mockActivitiesService = {
  getActivitiesByCase: vi.fn().mockResolvedValue(mockActivities),
};

vi.mock('@/lib/db', () => ({
  activitiesService: mockActivitiesService,
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
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
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

function setCurrentUser(user: { id: string; email: string } | null) {
  mockSupabaseUser = user;
}

describe('Cases Activities API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ id: ATTORNEY_ID, email: 'attorney@example.com' });

    // Reset supabase from mock
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'cases') {
        return createChainMock({
          id: CASE_ID,
          attorney_id: ATTORNEY_ID,
          client_id: CLIENT_ID,
          firm_id: null,
        });
      }
      return createChainMock(null);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cases/[id]/activities', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 when case does not exist', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'cases') {
          const chain = createChainMock(null);
          chain.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
          return chain;
        }
        return createChainMock(null);
      });

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(404);
    });

    it('should return 403 for user with no case access', async () => {
      setCurrentUser({ id: UNAUTHORIZED_USER_ID, email: 'other@example.com' });

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 200 with activities for attorney', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
    });

    it('should return 200 with activities for client', async () => {
      setCurrentUser({ id: CLIENT_ID, email: 'client@example.com' });

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
    });

    it('should respect limit param', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/activities?limit=10`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockActivitiesService.getActivitiesByCase).toHaveBeenCalledWith(CASE_ID, 10);
    });

    it('should clamp limit to max 100', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/activities?limit=200`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockActivitiesService.getActivitiesByCase).toHaveBeenCalledWith(CASE_ID, 100);
    });

    it('should default limit to 50', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockActivitiesService.getActivitiesByCase).toHaveBeenCalledWith(CASE_ID, 50);
    });

    it('should handle service errors gracefully', async () => {
      mockActivitiesService.getActivitiesByCase.mockRejectedValueOnce(new Error('DB error'));

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/activities`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });
  });
});
