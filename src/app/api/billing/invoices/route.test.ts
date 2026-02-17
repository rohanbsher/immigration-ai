import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'user-123';

const mockInvoices = [
  {
    id: 'inv-1',
    user_id: MOCK_USER_ID,
    amount: 4900,
    currency: 'usd',
    status: 'paid',
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'inv-2',
    user_id: MOCK_USER_ID,
    amount: 4900,
    currency: 'usd',
    status: 'paid',
    created_at: '2026-02-15T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

vi.mock('@/lib/db/subscriptions', () => ({
  getUserInvoices: vi.fn(),
}));

vi.mock('@/lib/auth/api-helpers', () => {
  const authenticateFn = vi.fn();

  const withAuth = (handler: any) => {
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
    withAttorneyAuth: (handler: any) => withAuth(handler),
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

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
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

import { GET } from './route';
import { getUserInvoices } from '@/lib/db/subscriptions';
import { authenticate } from '@/lib/auth/api-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: 'GET',
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  });
}

function mockAuth() {
  vi.mocked(authenticate).mockResolvedValue({
    success: true,
    user: { id: MOCK_USER_ID } as any,
    profile: { id: MOCK_USER_ID, role: 'attorney', email: 'test@example.com' } as any,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/billing/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(authenticate).mockResolvedValue({
      success: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      error: 'Unauthorized',
    } as any);

    const req = createRequest('/api/billing/invoices');
    const res = await GET(req, {} as any);

    expect(res.status).toBe(401);
  });

  it('returns invoices for authenticated user', async () => {
    vi.mocked(getUserInvoices).mockResolvedValue(mockInvoices as any);

    const req = createRequest('/api/billing/invoices');
    const res = await GET(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(2);
    expect(getUserInvoices).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it('returns empty array when no invoices', async () => {
    vi.mocked(getUserInvoices).mockResolvedValue([]);

    const req = createRequest('/api/billing/invoices');
    const res = await GET(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(0);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(getUserInvoices).mockRejectedValue(new Error('DB error'));

    const req = createRequest('/api/billing/invoices');
    const res = await GET(req, {} as any);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to fetch invoices');
  });
});
