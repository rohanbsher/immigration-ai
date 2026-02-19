/**
 * Integration tests for Clients API routes.
 *
 * Tests cover:
 * - GET /api/clients - List all clients for attorney
 * - GET /api/clients/search - Search clients
 * - GET /api/clients/[id] - Get client details
 * - PATCH /api/clients/[id] - Update client
 * - GET /api/clients/[id]/cases - Get client's cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockAttorneyId = 'attorney-123';
const mockClientId = 'client-456';
const mockOtherClientId = 'client-789';
const mockCaseId = 'case-abc';

const mockClient = {
  id: mockClientId,
  email: 'john.doe@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  date_of_birth: '1990-01-15',
  country_of_birth: 'United States',
  nationality: 'American',
  avatar_url: null,
  alien_number: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  cases_count: 2,
  active_cases_count: 1,
};

const mockClients = [
  mockClient,
  {
    id: mockOtherClientId,
    email: 'jane.smith@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    phone: '+0987654321',
    date_of_birth: '1985-06-20',
    country_of_birth: 'Canada',
    nationality: 'Canadian',
    avatar_url: null,
    alien_number: 'A123456789',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    cases_count: 1,
    active_cases_count: 1,
  },
];

const mockCases = [
  {
    id: mockCaseId,
    attorney_id: mockAttorneyId,
    client_id: mockClientId,
    visa_type: 'H-1B',
    status: 'in_review',
    title: 'H-1B Application',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'case-def',
    attorney_id: mockAttorneyId,
    client_id: mockClientId,
    visa_type: 'L-1',
    status: 'closed',
    title: 'L-1 Transfer',
    created_at: '2023-06-01T00:00:00Z',
    updated_at: '2023-12-01T00:00:00Z',
  },
];

const mockAttorneyProfile = {
  id: mockAttorneyId,
  email: 'attorney@example.com',
  role: 'attorney',
  first_name: 'Attorney',
  last_name: 'Test',
};

const mockClientProfile = {
  id: mockClientId,
  email: 'john.doe@example.com',
  role: 'client',
  first_name: 'John',
  last_name: 'Doe',
};

// Mock the supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock createClient function
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock db services
vi.mock('@/lib/db/clients', () => ({
  clientsService: {
    getClients: vi.fn(),
    getClientById: vi.fn(),
    updateClient: vi.fn(),
    searchClients: vi.fn(),
    getClientCases: vi.fn(),
  },
}));

vi.mock('@/lib/db/profiles', () => ({
  profilesService: {
    getProfile: vi.fn(),
  },
}));

// Mock auth helpers - need to mock authenticate and the wrapper functions
vi.mock('@/lib/auth/api-helpers', () => {
  const authenticateFn = vi.fn();

  // Create wrapper that uses the mocked authenticate
  const withAuth = (handler: any, options?: any) => {
    return async (request: any, context: any) => {
      const auth = await authenticateFn(request, options);
      if (!auth.success) {
        return auth.response;
      }
      try {
        return await handler(request, context, auth);
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    };
  };

  const withAttorneyAuth = (handler: any) => withAuth(handler, { roles: ['attorney'] });
  const withAdminAuth = (handler: any) => withAuth(handler, { roles: ['admin'] });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextResponse } = require('next/server');
  return {
    authenticate: authenticateFn,
    requireAttorney: vi.fn(),
    withAuth,
    withAttorneyAuth,
    withAdminAuth,
    errorResponse: (error: string, status: number) =>
      new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    successResponse: (data: any, status = 200) =>
      new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    safeParseBody: async (request: any) => {
      try {
        const data = await request.json();
        return { success: true, data };
      } catch {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          ),
        };
      }
    },
  };
});

// Mock rate limiter
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
    check: vi.fn().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  aiRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 9, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  authRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 4, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 19, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  }),
  resetRateLimit: vi.fn(),
  clearAllRateLimits: vi.fn(),
  isRedisRateLimitingEnabled: vi.fn().mockReturnValue(false),
}));

// Import handlers after mocks are set up
import { GET as getClients } from './route';
import { GET as searchClients } from './search/route';
import { GET as getClient, PATCH as updateClient } from './[id]/route';
import { GET as getClientCases } from './[id]/cases/route';
import { clientsService } from '@/lib/db/clients';
import { profilesService } from '@/lib/db/profiles';
import { authenticate } from '@/lib/auth/api-helpers';
import { sensitiveRateLimiter } from '@/lib/rate-limit';

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  let url = `http://localhost:3000${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const request = new NextRequest(url, requestInit);

  // Override json() method to properly return the body in jsdom environment
  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create mock params
function createMockParams(id: string = mockClientId): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('Clients API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/clients
  // Note: This route uses withAttorneyAuth which calls authenticate internally
  // ==========================================================================
  describe('GET /api/clients', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: false,
        error: 'Unauthorized',
        response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }) as any,
      });

      const request = createMockRequest('GET', '/api/clients');
      const response = await getClients(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when non-attorney tries to access', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: false,
        error: 'Forbidden',
        response: new Response(JSON.stringify({ success: false, error: 'Access denied. Required role: attorney' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }) as any,
      });

      const request = createMockRequest('GET', '/api/clients');
      const response = await getClients(request);

      expect(response.status).toBe(403);
    });

    it('should return list of clients for attorney', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: true,
        user: { id: mockAttorneyId, email: 'attorney@example.com' } as any,
        profile: mockAttorneyProfile as any,
      });
      vi.mocked(clientsService.getClients).mockResolvedValue({
        data: mockClients as any,
        total: 2,
      });

      const request = createMockRequest('GET', '/api/clients');
      const response = await getClients(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].email).toBe('john.doe@example.com');
      expect(json.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(clientsService.getClients).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
      });
    });

    it('should return empty array when attorney has no clients', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: true,
        user: { id: mockAttorneyId, email: 'attorney@example.com' } as any,
        profile: mockAttorneyProfile as any,
      });
      vi.mocked(clientsService.getClients).mockResolvedValue({
        data: [],
        total: 0,
      });

      const request = createMockRequest('GET', '/api/clients');
      const response = await getClients(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toHaveLength(0);
      expect(json.pagination.total).toBe(0);
    });

    it('should pass pagination params to service', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: true,
        user: { id: mockAttorneyId, email: 'attorney@example.com' } as any,
        profile: mockAttorneyProfile as any,
      });
      vi.mocked(clientsService.getClients).mockResolvedValue({
        data: [mockClients[0]] as any,
        total: 2,
      });

      const request = createMockRequest('GET', '/api/clients', undefined, {
        page: '2',
        limit: '1',
        search: 'john',
      });
      const response = await getClients(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.pagination).toEqual({
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
      expect(clientsService.getClients).toHaveBeenCalledWith({
        page: 2,
        limit: 1,
        search: 'john',
      });
    });

    it('should clamp pagination params to valid ranges', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: true,
        user: { id: mockAttorneyId, email: 'attorney@example.com' } as any,
        profile: mockAttorneyProfile as any,
      });
      vi.mocked(clientsService.getClients).mockResolvedValue({
        data: [],
        total: 0,
      });

      const request = createMockRequest('GET', '/api/clients', undefined, {
        page: '-5',
        limit: '999',
      });
      await getClients(request);

      expect(clientsService.getClients).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
        search: undefined,
      });
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: true,
        user: { id: mockAttorneyId, email: 'attorney@example.com' } as any,
        profile: mockAttorneyProfile as any,
      });
      vi.mocked(clientsService.getClients).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('GET', '/api/clients');
      const response = await getClients(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch clients');
    });
  });

  // ==========================================================================
  // GET /api/clients/search
  // ==========================================================================
  describe('GET /api/clients/search', () => {
    beforeEach(() => {
      // Mock profile query for role check
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'attorney' },
          error: null,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'john' });
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when non-attorney tries to search', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'client' },
          error: null,
        }),
      });

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'john' });
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only attorneys can search clients');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }) as any,
      });

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'john' });
      const response = await searchClients(request);

      expect(response.status).toBe(429);
    });

    it('should return empty array for query less than 2 characters', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true });

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'j' });
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
      expect(clientsService.searchClients).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true });

      const request = createMockRequest('GET', '/api/clients/search', undefined, {});
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should search clients with valid query', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true });
      vi.mocked(clientsService.searchClients).mockResolvedValue([mockClient] as any);

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'john' });
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].first_name).toBe('John');
      expect(clientsService.searchClients).toHaveBeenCalledWith('john');
    });

    it('should handle search errors gracefully', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true });
      vi.mocked(clientsService.searchClients).mockRejectedValue(new Error('Search error'));

      const request = createMockRequest('GET', '/api/clients/search', undefined, { q: 'john' });
      const response = await searchClients(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to search clients');
    });
  });

  // ==========================================================================
  // GET /api/clients/[id]
  // ==========================================================================
  describe('GET /api/clients/[id]', () => {
    beforeEach(() => {
      // Mock case query for access check (canAccessClient adds .is('deleted_at', null))
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: mockCaseId }],
          error: null,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('GET', `/api/clients/${mockClientId}`);
      const response = await getClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user has no access to client', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const request = createMockRequest('GET', `/api/clients/${mockOtherClientId}`);
      const response = await getClient(request, { params: createMockParams(mockOtherClientId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 404 when client does not exist', async () => {
      vi.mocked(clientsService.getClientById).mockResolvedValue(null);

      const request = createMockRequest('GET', `/api/clients/${mockClientId}`);
      const response = await getClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Client not found');
    });

    it('should return client when attorney has access', async () => {
      vi.mocked(clientsService.getClientById).mockResolvedValue(mockClient as any);

      const request = createMockRequest('GET', `/api/clients/${mockClientId}`);
      const response = await getClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockClientId);
      expect(data.first_name).toBe('John');
      expect(clientsService.getClientById).toHaveBeenCalledWith(mockClientId);
    });

    it('should return client when client views own profile', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'john.doe@example.com' } },
        error: null,
      });

      vi.mocked(clientsService.getClientById).mockResolvedValue(mockClient as any);

      const request = createMockRequest('GET', `/api/clients/${mockClientId}`);
      const response = await getClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockClientId);
    });
  });

  // ==========================================================================
  // PATCH /api/clients/[id]
  // ==========================================================================
  describe('PATCH /api/clients/[id]', () => {
    beforeEach(() => {
      // Mock case query for access check (canAccessClient adds .is('deleted_at', null))
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: mockCaseId }],
          error: null,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user has no access to client', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const request = createMockRequest('PATCH', `/api/clients/${mockOtherClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams(mockOtherClientId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 403 when client tries to update other client', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'john.doe@example.com' } },
        error: null,
      });
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockClientProfile as any);

      // Client can access their own profile
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const request = createMockRequest('PATCH', `/api/clients/${mockOtherClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams(mockOtherClientId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid update data', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockAttorneyProfile as any);

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        first_name: '', // Invalid: must be at least 1 character
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should update client when attorney modifies', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockAttorneyProfile as any);
      vi.mocked(clientsService.updateClient).mockResolvedValue({
        ...mockClient,
        first_name: 'Johnny',
      } as any);

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.first_name).toBe('Johnny');
      expect(clientsService.updateClient).toHaveBeenCalledWith(mockClientId, { first_name: 'Johnny' });
    });

    it('should allow client to update own profile', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'john.doe@example.com' } },
        error: null,
      });
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockClientProfile as any);
      vi.mocked(clientsService.updateClient).mockResolvedValue({
        ...mockClient,
        phone: '+1111111111',
      } as any);

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        phone: '+1111111111',
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phone).toBe('+1111111111');
    });

    it('should handle update errors gracefully', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockAttorneyProfile as any);
      vi.mocked(clientsService.updateClient).mockRejectedValue(new Error('Update error'));

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update client');
    });
  });

  // ==========================================================================
  // GET /api/clients/[id]/cases
  // ==========================================================================
  describe('GET /api/clients/[id]/cases', () => {
    beforeEach(() => {
      // Mock profile and case queries
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: 'attorney' },
              error: null,
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: mockCaseId }],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('GET', `/api/clients/${mockClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when client tries to view other client cases', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'john.doe@example.com' } },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: 'client' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const request = createMockRequest('GET', `/api/clients/${mockOtherClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams(mockOtherClientId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Clients can only view their own cases');
    });

    it('should return 403 when attorney has no cases with client', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: 'attorney' },
              error: null,
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const request = createMockRequest('GET', `/api/clients/${mockOtherClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams(mockOtherClientId) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You do not have access to this client's cases");
    });

    it('should return client cases when attorney has access', async () => {
      vi.mocked(clientsService.getClientCases).mockResolvedValue(mockCases as any);

      const request = createMockRequest('GET', `/api/clients/${mockClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].visa_type).toBe('H-1B');
      expect(clientsService.getClientCases).toHaveBeenCalledWith(mockClientId);
    });

    it('should return own cases when client views', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'john.doe@example.com' } },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: 'client' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      vi.mocked(clientsService.getClientCases).mockResolvedValue(mockCases as any);

      const request = createMockRequest('GET', `/api/clients/${mockClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('should return 403 for invalid user role', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { role: 'invalid' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const request = createMockRequest('GET', `/api/clients/${mockClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid user role');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(clientsService.getClientCases).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('GET', `/api/clients/${mockClientId}/cases`);
      const response = await getClientCases(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch client cases');
    });
  });

  // ==========================================================================
  // Edge cases and security tests
  // ==========================================================================
  describe('Security and edge cases', () => {
    it('should not leak client data in error messages', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const request = createMockRequest('GET', `/api/clients/${mockClientId}`);
      const response = await getClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      // Error should not contain client details
      expect(JSON.stringify(data)).not.toContain('john.doe@example.com');
    });

    it('should handle null profile gracefully in update', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(null);
      vi.mocked(clientsService.updateClient).mockResolvedValue({
        ...mockClient,
        first_name: 'Johnny',
      } as any);

      // Mock access check to pass (canAccessClient adds .is('deleted_at', null))
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: mockCaseId }],
          error: null,
        }),
      });

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        first_name: 'Johnny',
      });
      const response = await updateClient(request, { params: createMockParams() });

      // Should still succeed when profile is null (non-client case)
      expect(response.status).toBe(200);
    });

    it('should allow nullable fields in client update', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockAttorneyProfile as any);
      vi.mocked(clientsService.updateClient).mockResolvedValue({
        ...mockClient,
        phone: null,
        date_of_birth: null,
      } as any);

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: mockCaseId }],
          error: null,
        }),
      });

      const request = createMockRequest('PATCH', `/api/clients/${mockClientId}`, {
        phone: null,
        date_of_birth: null,
      });
      const response = await updateClient(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phone).toBeNull();
      expect(data.date_of_birth).toBeNull();
    });
  });
});
