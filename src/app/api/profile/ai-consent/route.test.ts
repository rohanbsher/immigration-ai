import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'user-123';
const MOCK_CONSENT_DATE = '2026-01-15T00:00:00Z';

// ---------------------------------------------------------------------------
// Mock supabase
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockEqSelect = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));
const mockEqUpdate = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdate }));
const mockFrom = vi.fn(() => {
  return {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock auth helpers
// ---------------------------------------------------------------------------

// Track options passed to withAuth so tests can assert { rateLimit: false }
// vi.hoisted runs before vi.mock hoisting, making this available in the factory
const { withAuthCalls } = vi.hoisted(() => ({
  withAuthCalls: [] as Array<{ handler: any; options: any }>,
}));

vi.mock('@/lib/auth/api-helpers', () => {
  const authenticateFn = vi.fn();

  const withAuth = (handler: any, options?: any) => {
    withAuthCalls.push({ handler, options });
    return async (request: any, context: any) => {
      const auth = await authenticateFn(request);
      if (!auth.success) {
        return auth.response;
      }
      try {
        return await handler(request, context, auth);
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    };
  };

  return {
    authenticate: authenticateFn,
    withAuth,
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
  };
});

// ---------------------------------------------------------------------------
// Mock rate limiter & logger
// ---------------------------------------------------------------------------

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    SENSITIVE: { maxRequests: 10, windowMs: 60000, keyPrefix: 'sensitive' },
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST, DELETE } from './route';
import { authenticate } from '@/lib/auth/api-helpers';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' }),
  });
}

function mockAuth() {
  vi.mocked(authenticate).mockResolvedValue({
    success: true,
    user: { id: MOCK_USER_ID } as any,
    profile: { id: MOCK_USER_ID, role: 'attorney', email: 'test@example.com' } as any,
  });
}

function mockUnauth() {
  vi.mocked(authenticate).mockResolvedValue({
    success: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    error: 'Unauthorized',
  } as any);
}

// ---------------------------------------------------------------------------
// Tests — withAuth wiring
// ---------------------------------------------------------------------------

describe('AI Consent API - withAuth options', () => {
  it('GET uses default withAuth options (standard rate limiting)', () => {
    // withAuthCalls[0] = GET registration
    expect(withAuthCalls[0].options).toBeUndefined();
  });

  it('POST disables withAuth rate limiting (uses manual SENSITIVE)', () => {
    // withAuthCalls[1] = POST registration
    expect(withAuthCalls[1].options).toEqual({ rateLimit: false });
  });

  it('DELETE disables withAuth rate limiting (uses manual SENSITIVE)', () => {
    // withAuthCalls[2] = DELETE registration
    expect(withAuthCalls[2].options).toEqual({ rateLimit: false });
  });
});

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe('AI Consent API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauth();

    const req = createRequest('GET', '/api/profile/ai-consent');
    const res = await GET(req, {});

    expect(res.status).toBe(401);
  });

  it('returns consented: true when ai_consent_granted_at is set', async () => {
    mockSingle.mockResolvedValue({
      data: { ai_consent_granted_at: MOCK_CONSENT_DATE },
      error: null,
    });

    const req = createRequest('GET', '/api/profile/ai-consent');
    const res = await GET(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.consented).toBe(true);
    expect(json.data.consentedAt).toBe(MOCK_CONSENT_DATE);

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalledWith('ai_consent_granted_at');
    expect(mockEqSelect).toHaveBeenCalledWith('id', MOCK_USER_ID);
  });

  it('returns consented: false when ai_consent_granted_at is null', async () => {
    mockSingle.mockResolvedValue({
      data: { ai_consent_granted_at: null },
      error: null,
    });

    const req = createRequest('GET', '/api/profile/ai-consent');
    const res = await GET(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.consented).toBe(false);
    expect(json.data.consentedAt).toBeNull();
  });

  it('returns 500 when database query fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed', code: 'PGRST000' },
    });

    const req = createRequest('GET', '/api/profile/ai-consent');
    const res = await GET(req, {});
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to check consent');
  });
});

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe('AI Consent API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    mockEqUpdate.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauth();

    const req = createRequest('POST', '/api/profile/ai-consent');
    const res = await POST(req, {});

    expect(res.status).toBe(401);
  });

  it('grants consent (happy path)', async () => {
    const req = createRequest('POST', '/api/profile/ai-consent');
    const res = await POST(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.message).toBe('AI consent granted');

    // Verify SENSITIVE rate limiting keyed by user ID (not IP)
    expect(rateLimit).toHaveBeenCalledWith(RATE_LIMITS.SENSITIVE, MOCK_USER_ID);

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ai_consent_granted_at: expect.any(String) })
    );
    expect(mockEqUpdate).toHaveBeenCalledWith('id', MOCK_USER_ID);
  });

  it('returns 429 with Retry-After header when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, retryAfter: 30 });

    const req = createRequest('POST', '/api/profile/ai-consent');
    const res = await POST(req, {});
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('Too many requests');
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('returns 500 when database update fails', async () => {
    mockEqUpdate.mockResolvedValueOnce({
      error: { message: 'Database error', code: 'PGRST000' },
    });

    const req = createRequest('POST', '/api/profile/ai-consent');
    const res = await POST(req, {});
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to update consent');
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE
// ---------------------------------------------------------------------------

describe('AI Consent API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    mockEqUpdate.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauth();

    const req = createRequest('DELETE', '/api/profile/ai-consent');
    const res = await DELETE(req, {});

    expect(res.status).toBe(401);
  });

  it('revokes consent (happy path)', async () => {
    const req = createRequest('DELETE', '/api/profile/ai-consent');
    const res = await DELETE(req, {});
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.message).toBe('AI consent revoked');

    // Verify SENSITIVE rate limiting keyed by user ID (not IP)
    expect(rateLimit).toHaveBeenCalledWith(RATE_LIMITS.SENSITIVE, MOCK_USER_ID);

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ ai_consent_granted_at: null });
    expect(mockEqUpdate).toHaveBeenCalledWith('id', MOCK_USER_ID);
  });

  it('returns 429 with Retry-After header when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ success: false, retryAfter: 30 });

    const req = createRequest('DELETE', '/api/profile/ai-consent');
    const res = await DELETE(req, {});
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('Too many requests');
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('returns 500 when database update fails', async () => {
    mockEqUpdate.mockResolvedValueOnce({
      error: { message: 'Database error', code: 'PGRST000' },
    });

    const req = createRequest('DELETE', '/api/profile/ai-consent');
    const res = await DELETE(req, {});
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to update consent');
  });
});
