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

// Mock the client-side Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
}));

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

// Mock window.location for OAuth tests
const mockWindow = {
  location: {
    origin: 'http://localhost:3000',
  },
};
vi.stubGlobal('window', mockWindow);

import { auth, serverAuth } from './index';
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
import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

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

  describe('Client-side auth object', () => {
    describe('auth.signUp', () => {
      it('should sign up a new user successfully', async () => {
        const signUpData = {
          email: 'new@example.com',
          password: 'password123',
          role: 'client' as const,
          firstName: 'John',
          lastName: 'Doe',
        };

        const result = await auth.signUp(signUpData);

        const client = createClient();
        expect(client.auth.signUp).toHaveBeenCalledWith({
          email: signUpData.email,
          password: signUpData.password,
          options: {
            data: {
              first_name: signUpData.firstName,
              last_name: signUpData.lastName,
              role: signUpData.role,
              bar_number: undefined,
              firm_name: undefined,
            },
          },
        });
        expect(result).toBeDefined();
      });

      it('should include bar number and firm name for attorney signup', async () => {
        const signUpData = {
          email: 'attorney@example.com',
          password: 'password123',
          role: 'attorney' as const,
          firstName: 'Jane',
          lastName: 'Attorney',
          barNumber: 'BAR123',
          firmName: 'Law Firm LLC',
        };

        await auth.signUp(signUpData);

        const client = createClient();
        expect(client.auth.signUp).toHaveBeenCalledWith({
          email: signUpData.email,
          password: signUpData.password,
          options: {
            data: {
              first_name: signUpData.firstName,
              last_name: signUpData.lastName,
              role: signUpData.role,
              bar_number: signUpData.barNumber,
              firm_name: signUpData.firmName,
            },
          },
        });
      });

      it('should throw error when signup fails', async () => {
        const error = new Error('Signup failed');
        mockAuth.signUp.mockResolvedValueOnce({ data: null, error });

        await expect(
          auth.signUp({
            email: 'test@example.com',
            password: 'password',
            role: 'client',
            firstName: 'Test',
            lastName: 'User',
          })
        ).rejects.toThrow('Signup failed');
      });
    });

    describe('auth.signIn', () => {
      it('should sign in a user with email and password', async () => {
        const signInData = {
          email: 'test@example.com',
          password: 'password123',
        };

        const result = await auth.signIn(signInData);

        const client = createClient();
        expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
          email: signInData.email,
          password: signInData.password,
        });
        expect(result).toBeDefined();
        expect(result.user).toBeDefined();
      });

      it('should throw error when signin fails', async () => {
        const error = new Error('Invalid credentials');
        mockAuth.signInWithPassword.mockResolvedValueOnce({ data: null, error });

        await expect(
          auth.signIn({ email: 'test@example.com', password: 'wrong' })
        ).rejects.toThrow('Invalid credentials');
      });
    });

    describe('auth.signInWithOAuth', () => {
      it('should initiate Google OAuth flow', async () => {
        mockAuth.signInWithOAuth = vi.fn().mockResolvedValue({
          data: { provider: 'google', url: 'https://oauth.google.com' },
          error: null,
        });

        const result = await auth.signInWithOAuth('google');

        const client = createClient();
        expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: 'http://localhost:3000/api/auth/callback',
          },
        });
        expect(result).toBeDefined();
      });

      it('should initiate Azure OAuth flow', async () => {
        mockAuth.signInWithOAuth = vi.fn().mockResolvedValue({
          data: { provider: 'azure', url: 'https://login.microsoftonline.com' },
          error: null,
        });

        const result = await auth.signInWithOAuth('azure');

        const client = createClient();
        expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'azure',
          options: {
            redirectTo: 'http://localhost:3000/api/auth/callback',
          },
        });
        expect(result).toBeDefined();
      });

      it('should throw error when OAuth fails', async () => {
        const error = new Error('OAuth failed');
        mockAuth.signInWithOAuth = vi.fn().mockResolvedValue({ data: null, error });

        await expect(auth.signInWithOAuth('google')).rejects.toThrow('OAuth failed');
      });
    });

    describe('auth.signOut', () => {
      it('should sign out the user successfully', async () => {
        await auth.signOut();

        const client = createClient();
        expect(client.auth.signOut).toHaveBeenCalled();
      });

      it('should throw error when signout fails', async () => {
        const error = new Error('Signout failed');
        mockAuth.signOut.mockResolvedValueOnce({ error });

        await expect(auth.signOut()).rejects.toThrow('Signout failed');
      });
    });

    describe('auth.getUser', () => {
      it('should return the current user', async () => {
        const user = await auth.getUser();

        const client = createClient();
        expect(client.auth.getUser).toHaveBeenCalled();
        expect(user).toEqual(mockUser);
      });

      it('should throw error when getUser fails', async () => {
        const error = new Error('User not found');
        mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error });

        await expect(auth.getUser()).rejects.toThrow('User not found');
      });
    });

    describe('auth.getSession', () => {
      it('should return the current session', async () => {
        const session = await auth.getSession();

        const client = createClient();
        expect(client.auth.getSession).toHaveBeenCalled();
        expect(session).toEqual(mockSession);
      });

      it('should throw error when getSession fails', async () => {
        const error = new Error('Session expired');
        mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error });

        await expect(auth.getSession()).rejects.toThrow('Session expired');
      });
    });

    describe('auth.resetPassword', () => {
      it('should send password reset email', async () => {
        await auth.resetPassword('test@example.com');

        const client = createClient();
        expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com',
          { redirectTo: 'http://localhost:3000/reset-password' }
        );
      });

      it('should throw error when reset fails', async () => {
        const error = new Error('Email not found');
        mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error });

        await expect(auth.resetPassword('unknown@example.com')).rejects.toThrow(
          'Email not found'
        );
      });
    });

    describe('auth.updatePassword', () => {
      it('should update the user password', async () => {
        await auth.updatePassword('newPassword123');

        const client = createClient();
        expect(client.auth.updateUser).toHaveBeenCalledWith({
          password: 'newPassword123',
        });
      });

      it('should throw error when password update fails', async () => {
        const error = new Error('Password too weak');
        mockAuth.updateUser.mockResolvedValueOnce({ data: { user: null }, error });

        await expect(auth.updatePassword('weak')).rejects.toThrow('Password too weak');
      });
    });

    describe('auth.onAuthStateChange', () => {
      it('should subscribe to auth state changes', () => {
        const callback = vi.fn();

        const result = auth.onAuthStateChange(callback);

        const client = createClient();
        expect(client.auth.onAuthStateChange).toHaveBeenCalledWith(callback);
        expect(result).toBeDefined();
        expect(result.data.subscription.unsubscribe).toBeDefined();
      });
    });
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

      it('should return unknown when no IP headers present', () => {
        const request = createMockRequest();

        const ip = getClientIp(request);

        expect(ip).toBe('unknown');
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
        const body = response.json();

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
        const mockQueryBuilder = createMockQueryBuilder([]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found'),
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const request = createMockRequest();

        const result = await authenticate(request);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Profile not found');
        }
      });

      it('should check role when roles option provided', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

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

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.response.status).toBe(403);
        }
      });
    });

    describe('requireAdmin', () => {
      it('should allow admin role', async () => {
        const mockProfile = createMockProfile({ role: 'admin' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const request = createMockRequest();

        const result = await requireAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should reject non-admin role', async () => {
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

        const result = await requireAdmin(request);

        expect(result.success).toBe(false);
      });
    });

    describe('requireAttorneyOrAdmin', () => {
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

        const result = await requireAttorneyOrAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should allow admin role', async () => {
        const mockProfile = createMockProfile({ role: 'admin' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const request = createMockRequest();

        const result = await requireAttorneyOrAdmin(request);

        expect(result.success).toBe(true);
      });

      it('should reject client role', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

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
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

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
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrappedHandler = withAttorneyAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        await wrappedHandler(request, context);

        expect(handler).toHaveBeenCalled();
      });

      it('should reject non-attorney', async () => {
        const mockProfile = createMockProfile({ role: 'client' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

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
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrappedHandler = withAdminAuth(handler);

        const request = createMockRequest();
        const context = { params: Promise.resolve({}) };

        await wrappedHandler(request, context);

        expect(handler).toHaveBeenCalled();
      });

      it('should reject non-admin', async () => {
        const mockProfile = createMockProfile({ role: 'attorney' });
        const mockQueryBuilder = createMockQueryBuilder([mockProfile]);
        mockQueryBuilder.single = vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        });
        const mockClient = createMockSupabaseClient();
        mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
        vi.mocked(createServerClient).mockResolvedValueOnce(mockClient);

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
    describe('Empty and null handling', () => {
      it('should handle empty email in signIn', async () => {
        const error = new Error('Invalid email');
        mockAuth.signInWithPassword.mockResolvedValueOnce({ data: null, error });

        await expect(auth.signIn({ email: '', password: 'password' })).rejects.toThrow();
      });

      it('should handle empty password in signIn', async () => {
        const error = new Error('Password required');
        mockAuth.signInWithPassword.mockResolvedValueOnce({ data: null, error });

        await expect(auth.signIn({ email: 'test@example.com', password: '' })).rejects.toThrow();
      });
    });

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
