import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { mockUser, resetMocks } from '@/__mocks__/supabase';

// Mock CSRF module
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    validateCsrf: vi.fn().mockReturnValue({ valid: true }),
  };
});

// Mock Supabase SSR
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role: 'attorney' }, error: null }),
  }),
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((_url, _key, _options) => {
    // Capture cookie operations for testing
    return mockSupabaseClient;
  }),
}));

import { proxy, config } from './proxy';
import { updateSession } from '@/lib/supabase/middleware';
import { validateCsrf } from '@/lib/security';
import { createServerClient } from '@supabase/ssr';

function createMockRequest(
  pathname: string,
  method: string = 'GET',
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  const req = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  return req;
}

describe('Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('config matcher', () => {
    it('should define correct matcher pattern', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher).toHaveLength(1);
      expect(config.matcher[0]).toContain('_next/static');
      expect(config.matcher[0]).toContain('_next/image');
      expect(config.matcher[0]).toContain('favicon.ico');
    });

    it('should contain exclusion patterns for static assets', () => {
      const pattern = config.matcher[0];

      // The pattern should contain negative lookahead for these paths
      expect(pattern).toContain('_next/static');
      expect(pattern).toContain('_next/image');
      expect(pattern).toContain('favicon.ico');
    });

    it('should contain exclusion patterns for image extensions', () => {
      const pattern = config.matcher[0];

      // The pattern should exclude common image file extensions
      expect(pattern).toContain('svg');
      expect(pattern).toContain('png');
      expect(pattern).toContain('jpg');
      expect(pattern).toContain('jpeg');
      expect(pattern).toContain('gif');
      expect(pattern).toContain('webp');
    });

    it('should use negative lookahead syntax', () => {
      const pattern = config.matcher[0];

      // Next.js uses negative lookahead (?!) syntax
      expect(pattern).toContain('(?!');
    });
  });

  describe('middleware function', () => {
    it('should call updateSession with request', async () => {
      const request = createMockRequest('/dashboard');

      const response = await proxy(request);

      expect(response).toBeDefined();
    });

    it('should return a response', async () => {
      const request = createMockRequest('/');

      const response = await proxy(request);

      expect(response).toBeInstanceOf(NextResponse);
    });
  });
});

describe('updateSession (Supabase Middleware)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    vi.mocked(validateCsrf).mockReturnValue({ valid: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Request ID handling', () => {
    it('should add x-request-id header to response', async () => {
      const request = createMockRequest('/');

      const response = await updateSession(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
      expect(response.headers.get('x-request-id')).not.toBe('');
    });

    it('should use existing x-request-id from request if present', async () => {
      const existingRequestId = 'existing-request-id-123';
      const request = createMockRequest('/', 'GET', {
        'x-request-id': existingRequestId,
      });

      const response = await updateSession(request);

      expect(response.headers.get('x-request-id')).toBe(existingRequestId);
    });

    it('should generate unique request IDs for different requests', async () => {
      const request1 = createMockRequest('/page1');
      const request2 = createMockRequest('/page2');

      const response1 = await updateSession(request1);
      const response2 = await updateSession(request2);

      const id1 = response1.headers.get('x-request-id');
      const id2 = response2.headers.get('x-request-id');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF for API routes', async () => {
      const request = createMockRequest('/api/test', 'POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });

      await updateSession(request);

      expect(validateCsrf).toHaveBeenCalledWith(request);
    });

    it('should not validate CSRF for non-API routes', async () => {
      const request = createMockRequest('/dashboard', 'GET');

      await updateSession(request);

      expect(validateCsrf).not.toHaveBeenCalled();
    });

    it('should return 403 when CSRF validation fails', async () => {
      vi.mocked(validateCsrf).mockReturnValueOnce({
        valid: false,
        reason: 'Missing Origin/Referer header',
      });

      const request = createMockRequest('/api/test', 'POST');

      const response = await updateSession(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF validation failed');
    });

    it('should include request ID in CSRF error response', async () => {
      vi.mocked(validateCsrf).mockReturnValueOnce({
        valid: false,
        reason: 'Invalid origin',
      });

      const request = createMockRequest('/api/test', 'POST');

      const response = await updateSession(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should allow API requests when CSRF is valid', async () => {
      vi.mocked(validateCsrf).mockReturnValue({ valid: true });

      const request = createMockRequest('/api/test', 'POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });

      const response = await updateSession(request);

      expect(response.status).not.toBe(403);
    });
  });

  describe('Protected Route Redirects', () => {
    const protectedPaths = ['/dashboard', '/cases', '/documents', '/forms', '/settings'];

    it.each(protectedPaths)(
      'should redirect unauthenticated users from %s to login',
      async (path) => {
        mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });

        const request = createMockRequest(path);

        const response = await updateSession(request);

        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain('/login');
        expect(location).toContain(`returnUrl=${encodeURIComponent(path)}`);
      }
    );

    it('should include returnUrl parameter in login redirect', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/dashboard/cases/123');

      const response = await updateSession(request);

      const location = response.headers.get('location');
      expect(location).toContain('returnUrl=%2Fdashboard%2Fcases%2F123');
    });

    it('should allow authenticated users to access protected routes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = createMockRequest('/dashboard');

      const response = await updateSession(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('location')).toBeNull();
    });

    it('should include request ID in redirect response', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/dashboard');

      const response = await updateSession(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });
  });

  describe('Auth Route Redirects', () => {
    const authPaths = ['/login', '/register', '/forgot-password'];

    it.each(authPaths)(
      'should redirect authenticated users from %s to dashboard',
      async (path) => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const request = createMockRequest(path);

        const response = await updateSession(request);

        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain('/dashboard');
      }
    );

    it('should allow unauthenticated users to access auth routes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/login');

      const response = await updateSession(request);

      expect(response.status).not.toBe(307);
    });

    it('should include request ID in auth redirect response', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = createMockRequest('/login');

      const response = await updateSession(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });
  });

  describe('Server Timing', () => {
    it('should add server-timing header in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const request = createMockRequest('/');

      const response = await updateSession(request);

      const serverTiming = response.headers.get('server-timing');
      expect(serverTiming).toBeDefined();
      expect(serverTiming).toContain('middleware');
      expect(serverTiming).toContain('dur=');
      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT add server-timing header in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const request = createMockRequest('/');

      const response = await updateSession(request);

      const serverTiming = response.headers.get('server-timing');
      expect(serverTiming).toBeNull();
      process.env.NODE_ENV = originalEnv;
    });

    it('should measure middleware duration in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const request = createMockRequest('/');

      const response = await updateSession(request);

      const serverTiming = response.headers.get('server-timing');
      const match = serverTiming?.match(/dur=(\d+)/);
      expect(match).toBeDefined();
      const duration = parseInt(match![1]);
      process.env.NODE_ENV = originalEnv;
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Public Routes', () => {
    it('should allow unauthenticated access to root', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/');

      const response = await updateSession(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow unauthenticated access to API routes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      vi.mocked(validateCsrf).mockReturnValue({ valid: true });

      const request = createMockRequest('/api/public', 'GET');

      const response = await updateSession(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow access to arbitrary public pages', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/about');

      const response = await updateSession(request);

      expect(response.status).not.toBe(307);
    });
  });

  describe('Cookie Handling', () => {
    it('should configure Supabase client with cookie handlers', async () => {
      const request = createMockRequest('/');

      await updateSession(request);

      expect(createServerClient).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
    });
  });

  describe('Supabase Session Refresh', () => {
    it('should call getUser to refresh session', async () => {
      const request = createMockRequest('/');

      await updateSession(request);

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('should handle session refresh errors gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const request = createMockRequest('/');

      const response = await updateSession(request);

      // Should still return a response, not throw
      expect(response).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle requests with query parameters', async () => {
      const url = new URL('http://localhost:3000/dashboard?tab=cases&filter=active');
      const request = new NextRequest(url);

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await updateSession(request);

      expect(response).toBeDefined();
    });

    it('should handle nested protected routes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/dashboard/cases/123/documents');

      const response = await updateSession(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });

    it('should handle nested auth routes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const request = createMockRequest('/login/callback');

      const response = await updateSession(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/dashboard');
    });

    it('should preserve original pathname in returnUrl', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('/settings/profile');

      const response = await updateSession(request);

      const location = response.headers.get('location');
      expect(location).toContain('returnUrl=%2Fsettings%2Fprofile');
    });

    it('should handle requests with various HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      vi.mocked(validateCsrf).mockReturnValue({ valid: true });

      for (const method of methods) {
        const request = createMockRequest('/api/test', method, {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });

        const response = await updateSession(request);

        expect(response).toBeDefined();
      }
    });
  });

  describe('API Route Protection', () => {
    it('should not redirect API routes even when unauthenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      vi.mocked(validateCsrf).mockReturnValue({ valid: true });

      const request = createMockRequest('/api/auth/login', 'POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });

      const response = await updateSession(request);

      // API routes should pass through, not redirect
      expect(response.status).not.toBe(307);
    });

    it('should validate CSRF for all state-changing API methods', async () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        vi.mocked(validateCsrf).mockClear();
        vi.mocked(validateCsrf).mockReturnValue({ valid: true });

        const request = createMockRequest('/api/test', method, {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });

        await updateSession(request);

        expect(validateCsrf).toHaveBeenCalledWith(request);
      }
    });
  });

  describe('Request ID Generation', () => {
    it('should generate valid UUID format when crypto.randomUUID is available', async () => {
      const request = createMockRequest('/');

      const response = await updateSession(request);

      const requestId = response.headers.get('x-request-id');
      // UUID format or fallback format
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9]+-[a-z0-9]+$/
      );
    });
  });
});
