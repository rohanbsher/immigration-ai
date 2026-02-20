import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock getProfileAsAdmin (used by withAuth in logout route)
const mockGetProfileAsAdmin = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: (...args: unknown[]) => mockGetProfileAsAdmin(...args),
}));

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

// Import route handlers after mocking
import { POST as loginHandler } from './login/route';
import { POST as registerHandler } from './register/route';
import { POST as logoutHandler } from './logout/route';
import { GET as callbackHandler } from './callback/route';
import { createClient } from '@/lib/supabase/server';
import { authRateLimiter } from '@/lib/rate-limit';

// Helper to create mock NextRequest
function createMockRequest(
  options: {
    method?: string;
    body?: Record<string, unknown>;
    url?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'POST', body, url = 'http://localhost:3000/api/auth/login', headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    }),
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

// Mock user and session data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    first_name: 'John',
    last_name: 'Doe',
    role: 'attorney',
  },
};

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600000,
  user: mockUser,
};

const mockProfile = {
  id: 'user-123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'attorney',
  bar_number: 'BAR123',
  firm_name: 'Test Law Firm',
};

// Type the mocked functions
const mockedCreateClient = vi.mocked(createClient);
const mockedAuthRateLimiter = vi.mocked(authRateLimiter);

describe('Auth API Routes', () => {
  let mockSignInWithPassword: ReturnType<typeof vi.fn>;
  let mockSignUp: ReturnType<typeof vi.fn>;
  let mockSignOut: ReturnType<typeof vi.fn>;
  let mockExchangeCodeForSession: ReturnType<typeof vi.fn>;
  let mockGetSession: ReturnType<typeof vi.fn>;
  let mockGetUser: ReturnType<typeof vi.fn>;
  let mockFromSelect: ReturnType<typeof vi.fn>;
  let mockUpsertSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockSignInWithPassword = vi.fn();
    mockSignUp = vi.fn();
    mockSignOut = vi.fn();
    mockExchangeCodeForSession = vi.fn();
    mockGetSession = vi.fn();
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFromSelect = vi.fn();
    mockUpsertSelect = vi.fn().mockResolvedValue({ data: null, error: null });

    // Setup createClient mock
    mockedCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
        exchangeCodeForSession: mockExchangeCodeForSession,
        getSession: mockGetSession,
        getUser: mockGetUser,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockFromSelect,
          })),
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockUpsertSelect,
          })),
        })),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    // Default: rate limiting allows requests
    mockedAuthRateLimiter.limit.mockResolvedValue({ allowed: true } as { allowed: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in a user with valid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFromSelect.mockResolvedValue({ data: mockProfile, error: null });

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Login successful');
      expect(data.user).toBeUndefined();
      expect(data.session).toBeUndefined();
      expect(data.profile).toEqual(mockProfile);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'validPassword123',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const request = createMockRequest({
        body: {
          email: 'invalid-email',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email address');
    });

    it('should return 400 for missing password', async () => {
      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: '',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Password is required');
    });

    it('should return 401 for invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'wrongPassword',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded' }),
        { status: 429 }
      );
      mockedAuthRateLimiter.limit.mockResolvedValue({
        allowed: false,
        response: rateLimitResponse,
      } as { allowed: false; response: Response });

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);

      expect(response.status).toBe(429);
    });

    it('should return 500 for unexpected errors', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('An unexpected error occurred');
    });

    it('should create profile on-the-fly when profile is missing after login', async () => {
      const upsertedProfile = {
        id: 'user-123',
        role: 'attorney',
        first_name: 'John',
        last_name: 'Doe',
        email: 'test@example.com',
        avatar_url: null,
      };

      mockSignInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFromSelect.mockResolvedValue({ data: null, error: null });
      mockUpsertSelect.mockResolvedValue({ data: upsertedProfile, error: null });

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Login successful');
      expect(data.profile).toEqual(upsertedProfile);
      expect(data.user).toBeUndefined();
      expect(data.session).toBeUndefined();
    });

    it('should not allow admin role from user_metadata during fallback profile creation', async () => {
      const maliciousUser = {
        ...mockUser,
        user_metadata: {
          first_name: 'Hacker',
          last_name: 'McHackface',
          role: 'admin',
        },
      };

      mockSignInWithPassword.mockResolvedValue({
        data: { user: maliciousUser, session: mockSession },
        error: null,
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockFromSelect.mockResolvedValue({ data: null, error: null });
      mockUpsertSelect.mockResolvedValue({
        data: {
          id: 'user-123',
          role: 'client',
          first_name: 'Hacker',
          last_name: 'McHackface',
          email: 'test@example.com',
          avatar_url: null,
        },
        error: null,
      });

      const request = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.role).toBe('client');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a new attorney', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'attorney@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123456',
          firmName: 'Doe & Associates',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Account created successfully');
      expect(data.user).toBeUndefined();
      expect(data.session).toBeUndefined();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'attorney@example.com',
        password: 'Secure@Password123',
        options: {
          data: {
            first_name: 'John',
            last_name: 'Doe',
            role: 'attorney',
            bar_number: 'BAR123456',
            firm_name: 'Doe & Associates',
          },
        },
      });
    });

    it('should successfully register a new client', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { ...mockUser, user_metadata: { ...mockUser.user_metadata, role: 'client' } }, session: mockSession },
        error: null,
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'client@example.com',
          password: 'Secure@Password123',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Account created successfully');
    });

    it('should return 400 for invalid email format', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'not-an-email',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email address');
    });

    it('should return 400 for password less than 8 characters', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'short',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Password must be at least 8 characters');
    });

    it('should return 400 for missing first name', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: '',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('First name is required');
    });

    it('should return 400 for missing last name', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: '',
          role: 'attorney',
          barNumber: 'BAR123',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Last name is required');
    });

    it('should return 400 for invalid role', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'admin',
          barNumber: 'BAR123',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for attorney without bar number', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'attorney@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Bar number is required for attorneys');
    });

    it('should handle email confirmation required response', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'attorney@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123456',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Please check your email to confirm your account');
      expect(data.requiresConfirmation).toBe(true);
      expect(data.user).toBeUndefined();
    });

    it('should return 400 for Supabase registration errors', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'existing@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'attorney',
          barNumber: 'BAR123456',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Registration could not be completed. Please try again.');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too Many Requests' }),
        { status: 429 }
      );
      mockedAuthRateLimiter.limit.mockResolvedValue({
        allowed: false,
        response: rateLimitResponse,
      } as { allowed: false; response: Response });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);

      expect(response.status).toBe(429);
    });

    it('should return 500 for unexpected errors', async () => {
      mockSignUp.mockRejectedValue(new Error('Network error'));

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('An unexpected error occurred');
    });
  });

  describe('POST /api/auth/logout', () => {
    // The logout route uses withAuth wrapper, so we need to pass a request + context.
    // withAuth calls authenticate() which uses getUser + getProfileAsAdmin.
    const logoutRequest = () =>
      createMockRequest({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/logout',
      });

    it('should successfully log out a user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockGetProfileAsAdmin.mockResolvedValue({ profile: mockProfile, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const response = await logoutHandler(logoutRequest(), {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.message).toBe('Logged out successfully');
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await logoutHandler(logoutRequest(), {});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should return 400 for Supabase sign out errors', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockGetProfileAsAdmin.mockResolvedValue({ profile: mockProfile, error: null });
      mockSignOut.mockResolvedValue({
        error: { message: 'Session not found' },
      });

      const response = await logoutHandler(logoutRequest(), {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Logout failed');
    });

    it('should return 500 for unexpected errors', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockGetProfileAsAdmin.mockResolvedValue({ profile: mockProfile, error: null });
      mockSignOut.mockRejectedValue(new Error('Connection reset'));

      const response = await logoutHandler(logoutRequest(), {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('An unexpected error occurred');
    });
  });

  describe('GET /api/auth/callback', () => {
    it('should redirect to dashboard on successful code exchange', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-auth-code',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
    });

    it('should redirect to custom next path when provided', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-auth-code&next=/cases',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/cases');
    });

    it('should redirect to login with error on failed code exchange', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: { message: 'Invalid code' },
      });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=invalid-code',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/login?error=auth_callback_error');
    });

    it('should redirect to login with error when no code provided', async () => {
      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/login?error=auth_callback_error');
    });

    it('should sanitize next path to prevent open redirect - absolute URL', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=https://evil.com',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
    });

    it('should sanitize next path to prevent open redirect - protocol-relative URL', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=//evil.com',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
    });

    it('should sanitize next path with encoded characters', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/%2f/evil.com',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
    });

    it('should reject paths not in allowed list', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/admin',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
    });

    it('should allow valid nested paths', async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/cases/123',
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/cases/123');
    });

    it('should handle forwarded host in non-development environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code',
        headers: {
          'x-forwarded-host': 'app.example.com',
        },
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://app.example.com/dashboard');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should reject invalid forwarded host', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const request = createMockRequest({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/callback?code=valid-code',
        headers: {
          'x-forwarded-host': 'invalid host with spaces',
        },
      });

      const response = await callbackHandler(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});

describe('Auth API Validation Edge Cases', () => {
  let mockSignInWithPassword: ReturnType<typeof vi.fn>;
  let mockSignUp: ReturnType<typeof vi.fn>;
  let mockFromSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSignInWithPassword = vi.fn();
    mockSignUp = vi.fn();
    mockFromSelect = vi.fn();

    mockedCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: vi.fn(),
        exchangeCodeForSession: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockFromSelect,
          })),
        })),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockedAuthRateLimiter.limit.mockResolvedValue({ allowed: true } as { allowed: true });
  });

  describe('Login validation', () => {
    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should reject email with leading/trailing whitespace as invalid', async () => {
      const request = createMockRequest({
        body: {
          email: '  test@example.com  ',
          password: 'validPassword123',
        },
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email address');
    });
  });

  describe('Register validation', () => {
    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle special characters in names', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
        error: null,
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Secure@Password123',
          firstName: "O'Brien",
          lastName: 'Van der Berg',
          role: 'client',
        },
      });

      const response = await registerHandler(request);

      expect(response.status).toBe(200);
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({
              first_name: "O'Brien",
              last_name: 'Van der Berg',
            }),
          }),
        })
      );
    });

    it('should accept exactly 8 character password meeting complexity requirements', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
        error: null,
      });

      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'Ab1!xyzw',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);

      expect(response.status).toBe(200);
    });

    it('should return 400 for password missing uppercase letter', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'lowercase1!',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('uppercase');
    });

    it('should return 400 for password missing lowercase letter', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'UPPERCASE1!',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('lowercase');
    });

    it('should return 400 for password missing number', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'NoNumbers!@',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('number');
    });

    it('should return 400 for password missing special character', async () => {
      const request = createMockRequest({
        url: 'http://localhost:3000/api/auth/register',
        body: {
          email: 'test@example.com',
          password: 'NoSpecial1A',
          firstName: 'John',
          lastName: 'Doe',
          role: 'client',
        },
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('special');
    });

    it('should handle malformed JSON in register request', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON in request body');
    });
  });
});

describe('Auth API Coverage - Login Timeout & Profile Upsert Errors', () => {
  let mockSignInWithPassword: ReturnType<typeof vi.fn>;
  let mockGetSession: ReturnType<typeof vi.fn>;
  let mockFromSelect: ReturnType<typeof vi.fn>;
  let mockUpsertSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSignInWithPassword = vi.fn();
    mockGetSession = vi.fn();
    mockFromSelect = vi.fn();
    mockUpsertSelect = vi.fn().mockResolvedValue({ data: null, error: null });

    mockedCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: vi.fn(),
        signOut: vi.fn(),
        exchangeCodeForSession: vi.fn(),
        getSession: mockGetSession,
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockFromSelect,
          })),
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockUpsertSelect,
          })),
        })),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    mockedAuthRateLimiter.limit.mockResolvedValue({ allowed: true } as { allowed: true });
  });

  it('should return 504 when login times out', async () => {
    // Make signInWithPassword never resolve (simulate timeout)
    mockSignInWithPassword.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 60000))
    );

    // We need to mock the timeout to be very short
    // Since LOGIN_TIMEOUT_MS is 15s, we'll use fake timers
    vi.useFakeTimers();

    const request = createMockRequest({
      body: {
        email: 'test@example.com',
        password: 'validPassword123',
      },
    });

    const responsePromise = loginHandler(request);

    // Advance timers past the timeout
    await vi.advanceTimersByTimeAsync(16000);

    const response = await responsePromise;
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toBe('Login timed out. Please try again.');

    vi.useRealTimers();
  });

  it('should handle profile upsert error during on-the-fly creation', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    // Profile fetch returns null (missing profile)
    mockFromSelect.mockResolvedValue({ data: null, error: null });
    // Upsert fails
    mockUpsertSelect.mockResolvedValue({
      data: null,
      error: { message: 'Database constraint violation' },
    });

    const request = createMockRequest({
      body: {
        email: 'test@example.com',
        password: 'validPassword123',
      },
    });

    const response = await loginHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Login successful');
    // Profile should be null when upsert fails
    expect(data.profile).toBeNull();
  });
});

describe('Auth API Coverage - Callback Edge Cases', () => {
  let mockExchangeCodeForSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExchangeCodeForSession = vi.fn();

    mockedCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        exchangeCodeForSession: mockExchangeCodeForSession,
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('should redirect to origin in production without forwarded host', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should sanitize next path with backslash characters', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/dashboard\\..\\admin',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
  });

  it('should sanitize next path with query string on allowed path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/dashboard?tab=settings',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    // The path includes query string and it should be allowed
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard?tab=settings');
  });

  it('should handle next path with hash fragment (stripped by URL parser)', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    // Note: hash fragments (#security) are stripped by new URL() parsing,
    // so the next param becomes just '/settings'
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/settings#security',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    // Hash fragment is stripped before it reaches the route handler
    expect(response.headers.get('Location')).toBe('http://localhost:3000/settings');
  });

  it('should reject next path that does not start with /', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=dashboard',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
  });

  it('should reject next path containing :// protocol indicator', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/javascript://evil',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
  });

  it('should allow /reset-password as a valid redirect path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/reset-password',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/reset-password');
  });

  it('should allow /profile as a valid redirect path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/profile',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/profile');
  });

  it('should allow /forms as a valid redirect path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/forms',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/forms');
  });

  it('should allow /documents with nested path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/documents/upload',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/documents/upload');
  });

  it('should default to /dashboard when next param is missing', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');
  });

  it('should use origin redirect in development environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code&next=/cases',
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/cases');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should use origin redirect in development even with forwarded host', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/callback?code=valid-code',
      headers: {
        'x-forwarded-host': 'app.example.com',
      },
    });

    const response = await callbackHandler(request);

    expect(response.status).toBe(307);
    // In development, should use origin, not forwarded host
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard');

    process.env.NODE_ENV = originalNodeEnv;
  });
});
