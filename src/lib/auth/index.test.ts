import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  mockUser,
  mockSession,
  mockAuth,
  createMockQueryBuilder,
  createMockSupabaseClient,
  resetMocks,
} from '@/__mocks__/supabase';

// Mock the server-side Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => createMockSupabaseClient()),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
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

// Mock getProfileAsAdmin from admin module
vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn().mockResolvedValue({
    profile: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'attorney',
      first_name: 'Test',
      last_name: 'User',
      phone: null,
      mfa_enabled: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  }),
  getAdminClient: vi.fn(),
}));

import { serverAuth } from './index';
import {
  authenticate,
  requireAuth,
  requireAttorney,
  requireAdmin,
  requireAttorneyOrAdmin,
  verifyCaseAccess,
  verifyDocumentAccess,
  verifyFormAccess,
  withAuth,
  withAttorneyAuth,
  withAdminAuth,
  getClientIp,
  errorResponse,
  successResponse,
} from './api-helpers';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { getProfileAsAdmin } from '@/lib/supabase/admin';

// Helper to create mock NextRequest
function createMockRequest(options: {
  headers?: Record<string, string>;
  method?: string;
  url?: string;
} = {}): NextRequest {
  const headers = new Headers(options.headers || {});
  return {
    headers,
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3000/api/test',
  } as unknown as NextRequest;
}

// Helper to create mock profile data
function createMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: mockUser.id,
    email: mockUser.email,
    role: 'attorney',
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    mfa_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Authentication Module', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server-side serverAuth object', () => {
    describe('serverAuth.getUser', () => {
      it('should return the current user on server', async () => {
        const user = await serverAuth.getUser();

        expect(user).toEqual(mockUser);
      });

      it('should return null when user not authenticated', async () => {
        mockAuth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const user = await serverAuth.getUser();

        expect(user).toBeNull();
      });
    });

    describe('serverAuth.getSession', () => {
      it('should return the current session on server', async () => {
        const session = await serverAuth.getSession();

        expect(session).toEqual(mockSession);
      });

      it('should return null when no session', async () => {
        mockAuth.getSession.mockResolvedValueOnce({
          data: { session: null },
          error: new Error('No session'),
        });

        const session = await serverAuth.getSession();

        expect(session).toBeNull();
      });
    });

    describe('serverAuth.getProfile', () => {
      it('should return user profile', async () => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const profile = await serverAuth.getProfile();

        expect(profile).toEqual(mockProfile);
      });

      it('should return null when user not authenticated', async () => {
        mockAuth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const profile = await serverAuth.getProfile();

        expect(profile).toBeNull();
      });

      it('should return null when profile not found', async () => {
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Profile not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const profile = await serverAuth.getProfile();

        expect(profile).toBeNull();
      });
    });

    describe('serverAuth.requireAuth', () => {
      it('should return user when authenticated', async () => {
        const user = await serverAuth.requireAuth();

        expect(user).toEqual(mockUser);
      });

      it('should throw when not authenticated', async () => {
        mockAuth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        await expect(serverAuth.requireAuth()).rejects.toThrow('Unauthorized');
      });
    });
  });

  describe('API Helper Functions', () => {
    describe('getClientIp', () => {
      it('should extract IP from x-forwarded-for header', () => {
        const request = createMockRequest({
          headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        });

        const ip = getClientIp(request);

        expect(ip).toBe('192.168.1.1');
      });

      it('should extract IP from x-real-ip header', () => {
        const request = createMockRequest({
          headers: { 'x-real-ip': '192.168.1.2' },
        });

        const ip = getClientIp(request);

        expect(ip).toBe('192.168.1.2');
      });

      it('should return anonymous when no IP headers present', () => {
        const request = createMockRequest();

        const ip = getClientIp(request);

        expect(ip).toBe('anonymous');
      });

      it('should prefer x-forwarded-for over x-real-ip', () => {
        const request = createMockRequest({
          headers: {
            'x-forwarded-for': '192.168.1.1',
            'x-real-ip': '192.168.1.2',
          },
        });

        const ip = getClientIp(request);

        expect(ip).toBe('192.168.1.1');
      });
    });

    describe('errorResponse', () => {
      it('should create error response with status', () => {
        const response = errorResponse('Not found', 404);

        expect(response.status).toBe(404);
      });

      it('should include details when provided', async () => {
        const response = errorResponse('Validation error', 400, {
          fields: ['email', 'password'],
        });

        expect(response.status).toBe(400);
      });
    });

    describe('successResponse', () => {
      it('should create success response with default status 200', () => {
        const response = successResponse({ id: '123' });

        expect(response.status).toBe(200);
      });

      it('should create success response with custom status', () => {
        const response = successResponse({ id: '123' }, 201);

        expect(response.status).toBe(201);
      });
    });

    describe('authenticate', () => {
      beforeEach(() => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValue(mockClient);
      });

      it('should return success for authenticated user', async () => {
        const request = createMockRequest();

        const result = await authenticate(request);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.user).toBeDefined();
          expect(result.profile).toBeDefined();
        }
      });

      it('should return error when user not authenticated', async () => {
        mockAuth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });
        const request = createMockRequest();

        const result = await authenticate(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Unauthorized');
          expect(result.response.status).toBe(401);
        }
      });

      it('should return error when profile not found', async () => {
        // Mock getProfileAsAdmin to return no profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: null,
          error: new Error('Not found'),
        });

        const request = createMockRequest();

        const result = await authenticate(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Profile not found');
        }
      });

      it('should check role when roles option provided', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        // Mock getProfileAsAdmin to return client profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await authenticate(request, { roles: ['attorney'] });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Forbidden');
          expect(result.response.status).toBe(403);
        }
      });

      it('should pass when user has required role', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const request = createMockRequest();

        const result = await authenticate(request, { roles: ['attorney', 'admin'] });

        expect(result.success).toBe(true);
      });

      it('should return rate limit error when rate limited', async () => {
        vi.mocked(rateLimit).mockResolvedValueOnce({
          success: false,
          retryAfter: 60,
        });

        const request = createMockRequest();

        const result = await authenticate(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Too many requests');
          expect(result.response.status).toBe(429);
        }
      });

      it('should skip rate limiting when rateLimit is false', async () => {
        const request = createMockRequest();

        const result = await authenticate(request, { rateLimit: false });

        expect(result.success).toBe(true);
        expect(rateLimit).not.toHaveBeenCalled();
      });
    });

    describe('requireAuth', () => {
      beforeEach(() => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValue(mockClient);
      });

      it('should authenticate any user', async () => {
        const request = createMockRequest();

        const result = await requireAuth(request);

        expect(result.success).toBe(true);
      });
    });

    describe('requireAttorney', () => {
      it('should allow attorney role', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const request = createMockRequest();

        const result = await requireAttorney(request);

        expect(result.success).toBe(true);
      });

      it('should reject non-attorney role', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        // Mock getProfileAsAdmin to return client profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAttorney(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.response.status).toBe(403);
        }
      });
    });

    describe('requireAdmin', () => {
      it('should allow admin role', async () => {
        const mockProfile = createMockProfile({ role: 'admin' });
        // Mock getProfileAsAdmin to return admin profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should reject non-admin role', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        // Mock getProfileAsAdmin to return attorney profile (should fail admin check)
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAdmin(request);

        expect(result.success).toBe(false);
      });
    });

    describe('requireAttorneyOrAdmin', () => {
      it('should allow attorney role', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        // Mock getProfileAsAdmin to return attorney profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAttorneyOrAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should allow admin role', async () => {
        const mockProfile = createMockProfile({ role: 'admin' });
        // Mock getProfileAsAdmin to return admin profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAttorneyOrAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should reject client role', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        // Mock getProfileAsAdmin to return client profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const request = createMockRequest();

        const result = await requireAttorneyOrAdmin(request);

        expect(result.success).toBe(false);
      });
    });

    describe('verifyCaseAccess', () => {
      const mockCaseData = {
        id: 'case-123',
        attorney_id: 'attorney-user-id',
        client_id: 'client-user-id',
      };

      it('should allow attorney access to their case', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockCaseData]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockCaseData,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyCaseAccess('attorney-user-id', 'case-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isAttorney).toBe(true);
          expect(result.access.canModify).toBe(true);
          expect(result.access.canDelete).toBe(true);
        }
      });

      it('should allow client access to their case with limited permissions', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockCaseData]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockCaseData,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyCaseAccess('client-user-id', 'case-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isClient).toBe(true);
          expect(result.access.canView).toBe(true);
          expect(result.access.canModify).toBe(false);
          expect(result.access.canDelete).toBe(false);
        }
      });

      it('should deny access for unrelated user', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockCaseData]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockCaseData,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyCaseAccess('other-user-id', 'case-123');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied');
          expect(result.status).toBe(403);
        }
      });

      it('should return not found for missing case', async () => {
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyCaseAccess('user-id', 'nonexistent-case');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Case not found');
          expect(result.status).toBe(404);
        }
      });
    });

    describe('verifyDocumentAccess', () => {
      const mockDocument = {
        id: 'doc-123',
        case_id: 'case-123',
        uploaded_by: 'client-user-id',
      };
      const mockCaseData = {
        id: 'case-123',
        attorney_id: 'attorney-user-id',
        client_id: 'client-user-id',
      };

      it('should allow attorney access to document', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockDocument]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockDocument, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyDocumentAccess('attorney-user-id', 'doc-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isAttorney).toBe(true);
          expect(result.access.canModify).toBe(true);
        }
      });

      it('should allow client who uploaded to delete their document', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockDocument]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockDocument, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyDocumentAccess('client-user-id', 'doc-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isClient).toBe(true);
          expect(result.access.isOwner).toBe(true);
          expect(result.access.canDelete).toBe(true);
          expect(result.access.canModify).toBe(false);
        }
      });

      it('should deny access for unrelated user', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockDocument]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockDocument, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyDocumentAccess('other-user-id', 'doc-123');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied');
          expect(result.status).toBe(403);
        }
      });

      it('should return not found for missing document', async () => {
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyDocumentAccess('user-id', 'nonexistent-doc');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Document not found');
          expect(result.status).toBe(404);
        }
      });
    });

    describe('verifyFormAccess', () => {
      const mockForm = {
        id: 'form-123',
        case_id: 'case-123',
      };
      const mockCaseData = {
        id: 'case-123',
        attorney_id: 'attorney-user-id',
        client_id: 'client-user-id',
      };

      it('should allow attorney access to form', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockForm]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockForm, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyFormAccess('attorney-user-id', 'form-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isAttorney).toBe(true);
          expect(result.access.canModify).toBe(true);
          expect(result.access.canDelete).toBe(true);
        }
      });

      it('should allow client view-only access to form', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockForm]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockForm, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyFormAccess('client-user-id', 'form-123');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.access.isClient).toBe(true);
          expect(result.access.canView).toBe(true);
          expect(result.access.canModify).toBe(false);
          expect(result.access.canDelete).toBe(false);
        }
      });

      it('should deny access for unrelated user', async () => {
        const mockQueryBuilder = createMockQueryBuilder([mockForm]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockForm, error: null })
          .mockResolvedValueOnce({ data: mockCaseData, error: null });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyFormAccess('other-user-id', 'form-123');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied');
          expect(result.status).toBe(403);
        }
      });

      it('should return not found for missing form', async () => {
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyFormAccess('user-id', 'nonexistent-form');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Form not found');
          expect(result.status).toBe(404);
        }
      });
    });

    describe('withAuth HOF', () => {
      beforeEach(() => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValue(mockClient);
      });

      it('should wrap handler and pass auth to it', async () => {
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrappedHandler = withAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        await wrappedHandler(request, context);

        expect(handler).toHaveBeenCalled();
        const [, , auth] = handler.mock.calls[0];
        expect(auth.success).toBe(true);
        expect(auth.user).toBeDefined();
        expect(auth.profile).toBeDefined();
      });

      it('should return error response when authentication fails', async () => {
        mockAuth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        const handler = vi.fn();
        const wrappedHandler = withAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        const response = await wrappedHandler(request, context);

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(401);
      });

      it('should handle errors in handler', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
        const wrappedHandler = withAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        const response = await wrappedHandler(request, context);

        expect(response.status).toBe(500);
        consoleErrorSpy.mockRestore();
      });

      it('should pass options to authenticate', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        // Mock getProfileAsAdmin to return client profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const handler = vi.fn();
        const wrappedHandler = withAuth(handler, { roles: ['attorney'] });

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        const response = await wrappedHandler(request, context);

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
      });
    });

    describe('withAttorneyAuth HOF', () => {
      it('should require attorney role', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        // Mock getProfileAsAdmin to return attorney profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrappedHandler = withAttorneyAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        await wrappedHandler(request, context);

        expect(handler).toHaveBeenCalled();
      });

      it('should reject non-attorney', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        // Mock getProfileAsAdmin to return client profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const handler = vi.fn();
        const wrappedHandler = withAttorneyAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        const response = await wrappedHandler(request, context);

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
      });
    });

    describe('withAdminAuth HOF', () => {
      it('should require admin role', async () => {
        const mockProfile = createMockProfile({ role: 'admin' });
        // Mock getProfileAsAdmin to return admin profile
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrappedHandler = withAdminAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        await wrappedHandler(request, context);

        expect(handler).toHaveBeenCalled();
      });

      it('should reject non-admin', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        // Mock getProfileAsAdmin to return attorney profile (should fail admin check)
        vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
          profile: mockProfile,
          error: null,
        });

        const handler = vi.fn();
        const wrappedHandler = withAdminAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        const response = await wrappedHandler(request, context);

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
      });
    });
  });

  describe('Edge Cases', () => {
    describe('Rate limiting edge cases', () => {
      it('should use custom rate limit key when provided', async () => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValue(mockClient);

        const request = createMockRequest();

        await authenticate(request, { rateLimitKey: 'custom-key' });

        expect(rateLimit).toHaveBeenCalledWith(
          expect.any(Object),
          'custom-key'
        );
      });

      it('should use different rate limit configs', async () => {
        const mockProfile = createMockProfile();
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValue(mockClient);

        const request = createMockRequest();

        await authenticate(request, { rateLimit: 'AI' });

        expect(rateLimit).toHaveBeenCalledWith(
          expect.objectContaining({ keyPrefix: 'ai' }),
          expect.any(String)
        );
      });
    });

    describe('Multiple x-forwarded-for IPs', () => {
      it('should extract first IP from comma-separated list', () => {
        const request = createMockRequest({
          headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1, 172.16.0.1  ' },
        });

        const ip = getClientIp(request);

        expect(ip).toBe('192.168.1.1');
      });
    });

    describe('Case access with deleted items', () => {
      it('should not find deleted cases', async () => {
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyCaseAccess('user-id', 'deleted-case-id');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.status).toBe(404);
        }
      });
    });

    describe('Document access when case is deleted', () => {
      it('should return case not found when document exists but case is deleted', async () => {
        const mockDocument = {
          id: 'doc-123',
          case_id: 'deleted-case',
          uploaded_by: 'user-id',
        };

        const mockQueryBuilder = createMockQueryBuilder([mockDocument]);
        mockQueryBuilder.single = vi
          .fn()
          .mockResolvedValueOnce({ data: mockDocument, error: null })
          .mockResolvedValueOnce({ data: null, error: new Error('Not found') });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const result = await verifyDocumentAccess('user-id', 'doc-123');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Case not found');
          expect(result.status).toBe(404);
        }
      });
    });
  });
});
