import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
vi.mock('@/lib/auth', () => ({
  serverAuth: {
    getUser: vi.fn(),
    getProfile: vi.fn(),
    getSession: vi.fn(),
    requireAuth: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
}));

vi.mock('@/lib/db/base-service', () => ({
  sanitizeSearchInput: vi.fn((input: string) => input.replace(/[%_]/g, '').trim()),
}));

vi.mock('@/lib/validation', () => ({
  schemas: {
    uuid: {
      safeParse: vi.fn((val: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(val)) {
          return { success: true, data: val };
        }
        return { success: false, error: { message: 'Invalid ID format' } };
      }),
    },
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

vi.mock('@/lib/stripe/client', () => ({
  getStripeClient: vi.fn(),
}));

// Import route handlers after mocking
import { GET as usersListHandler } from './users/route';
import { GET as userDetailHandler } from './users/[id]/route';
import { POST as suspendHandler } from './users/[id]/suspend/route';
import { POST as unsuspendHandler } from './users/[id]/unsuspend/route';
import { GET as statsHandler } from './stats/route';

import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe/client';

// Helper to create mock NextRequest
function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    }),
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const req = new NextRequest(`http://localhost:3000${url}`, init);
  if (body) {
    req.json = async () => body;
  }
  return req;
}

// Valid UUID for testing
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('Admin API Routes', () => {
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockAdminClient: {
    auth: {
      admin: {
        getUserById: ReturnType<typeof vi.fn>;
        updateUserById: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rate limit allows, admin profile
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 });
    vi.mocked(serverAuth.getProfile).mockResolvedValue({
      id: ADMIN_UUID,
      role: 'admin',
      email: 'admin@example.com',
    } as never);

    // Default Supabase mock
    mockFrom = vi.fn();
    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
      auth: { getUser: vi.fn() },
    } as never);

    // Default: Stripe not configured (returns null)
    vi.mocked(getStripeClient).mockReturnValue(null);

    // Default admin client mock
    mockAdminClient = {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
          updateUserById: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
        },
      },
    };
    vi.mocked(getAdminClient).mockReturnValue(mockAdminClient as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── GET /api/admin/users ──────────────────────────────────────────
  describe('GET /api/admin/users', () => {
    function setupUsersQuery(
      users: Record<string, unknown>[],
      count: number,
      error: { message: string } | null = null
    ) {
      const chainable = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: users, count, error }),
      };
      mockFrom.mockReturnValue(chainable);
      return chainable;
    }

    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests');
    });

    it('returns 403 when non-admin user', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue({
        id: 'user-1',
        role: 'attorney',
        email: 'attorney@example.com',
      } as never);

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 403 when profile is null', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue(null as never);

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 200 with paginated users', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@example.com', first_name: 'Alice', last_name: 'A', role: 'attorney', created_at: '2026-01-01', updated_at: '2026-01-02' },
        { id: 'u2', email: 'b@example.com', first_name: 'Bob', last_name: 'B', role: 'client', created_at: '2026-01-03', updated_at: '2026-01-04' },
      ];
      setupUsersQuery(mockUsers, 2);

      // Admin client returns no banned users
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { banned_until: null } },
        error: null,
      });

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.users).toHaveLength(2);
      expect(json.data.total).toBe(2);
      expect(json.data.page).toBe(1);
      expect(json.data.pageSize).toBe(20);
      expect(json.data.users[0].firstName).toBe('Alice');
      expect(json.data.users[0].suspended).toBe(false);
    });

    it('respects page and pageSize params', async () => {
      setupUsersQuery([], 0);

      const req = createRequest('GET', '/api/admin/users?page=3&pageSize=10');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.page).toBe(3);
      expect(json.data.pageSize).toBe(10);
    });

    it('caps pageSize at 100', async () => {
      setupUsersQuery([], 0);

      const req = createRequest('GET', '/api/admin/users?pageSize=500');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.pageSize).toBe(100);
    });

    it('applies search filter when search param provided', async () => {
      const chainable = setupUsersQuery([], 0);

      const req = createRequest('GET', '/api/admin/users?search=alice');
      const res = await usersListHandler(req);

      expect(res.status).toBe(200);
      expect(chainable.or).toHaveBeenCalled();
    });

    it('maps banned users correctly', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@example.com', first_name: 'Alice', last_name: 'A', role: 'attorney', created_at: '2026-01-01', updated_at: '2026-01-02' },
      ];
      setupUsersQuery(mockUsers, 1);

      // Make this user banned with a future date
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { banned_until: futureDate } },
        error: null,
      });

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.users[0].suspended).toBe(true);
    });

    it('defaults to not suspended when ban check fails', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@example.com', first_name: 'Alice', last_name: 'A', role: 'attorney', created_at: '2026-01-01', updated_at: '2026-01-02' },
      ];
      setupUsersQuery(mockUsers, 1);

      // Simulate ban check failure
      mockAdminClient.auth.admin.getUserById.mockRejectedValue(new Error('Network error'));

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.users[0].suspended).toBe(false);
    });

    it('returns 500 on database error', async () => {
      setupUsersQuery([], 0, { message: 'DB down' });

      const req = createRequest('GET', '/api/admin/users');
      const res = await usersListHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to fetch users');
    });
  });

  // ─── GET /api/admin/users/[id] ────────────────────────────────────
  describe('GET /api/admin/users/[id]', () => {
    function createParamsContext(id: string) {
      return { params: Promise.resolve({ id }) };
    }

    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('GET', `/api/admin/users/${VALID_UUID}`);
      const res = await userDetailHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests');
    });

    it('returns 403 when non-admin', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue({
        id: 'user-1',
        role: 'attorney',
      } as never);

      const req = createRequest('GET', `/api/admin/users/${VALID_UUID}`);
      const res = await userDetailHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 404 when user not found', async () => {
      const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: singleFn }),
      });

      const req = createRequest('GET', `/api/admin/users/${VALID_UUID}`);
      const res = await userDetailHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('User not found');
    });

    it('returns 200 with user details', async () => {
      const mockUser = {
        id: VALID_UUID,
        email: 'user@example.com',
        first_name: 'Alice',
        last_name: 'Smith',
        role: 'attorney',
        phone: '555-1234',
        mfa_enabled: false,
        avatar_url: null,
        bar_number: 'BAR123',
        firm_name: 'Smith Law',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
      };

      // The route calls supabase.from('profiles').select('*').eq('id', id).single()
      // then Promise.all for cases and subscriptions
      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles' && fromCallCount === 0) {
          fromCallCount++;
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
              }),
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ count: 5, error: null }),
              }),
            }),
          };
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { plan_type: 'pro', status: 'active', current_period_end: '2026-12-31' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      });

      const req = createRequest('GET', `/api/admin/users/${VALID_UUID}`);
      const res = await userDetailHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(VALID_UUID);
      expect(json.data.firstName).toBe('Alice');
      expect(json.data.lastName).toBe('Smith');
      expect(json.data.casesCount).toBe(5);
      expect(json.data.subscription).toBeDefined();
      expect(json.data.subscription.planType).toBe('pro');
    });

    it('returns 500 on error', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const req = createRequest('GET', `/api/admin/users/${VALID_UUID}`);
      const res = await userDetailHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to fetch user');
    });
  });

  // ─── POST /api/admin/users/[id]/suspend ───────────────────────────
  describe('POST /api/admin/users/[id]/suspend', () => {
    function createParamsContext(id: string) {
      return { params: Promise.resolve({ id }) };
    }

    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests');
    });

    it('returns 403 when non-admin', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue({
        id: 'user-1',
        role: 'client',
      } as never);

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 400 for invalid UUID', async () => {
      const req = createRequest('POST', '/api/admin/users/not-a-uuid/suspend');
      const res = await suspendHandler(req, createParamsContext('not-a-uuid'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid user ID');
    });

    it('returns 400 when trying to suspend own account', async () => {
      const req = createRequest('POST', `/api/admin/users/${ADMIN_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(ADMIN_UUID));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Cannot suspend your own account');
    });

    it('returns 404 when target user not found', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('User not found');
    });

    it('returns 404 when getUserById returns an error', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not found' },
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('User not found');
    });

    it('returns 200 on successful suspension', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: VALID_UUID, email: 'user@example.com' } },
        error: null,
      });
      mockAdminClient.auth.admin.updateUserById.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('User suspended');
      expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(VALID_UUID, {
        ban_duration: '876000h',
      });
    });

    it('returns 500 on admin API error during ban', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: VALID_UUID } },
        error: null,
      });
      mockAdminClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'Admin API error' },
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to suspend user');
    });

    it('returns 500 on unexpected exception', async () => {
      mockAdminClient.auth.admin.getUserById.mockRejectedValue(new Error('Network fail'));

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/suspend`);
      const res = await suspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to suspend user');
    });
  });

  // ─── POST /api/admin/users/[id]/unsuspend ─────────────────────────
  describe('POST /api/admin/users/[id]/unsuspend', () => {
    function createParamsContext(id: string) {
      return { params: Promise.resolve({ id }) };
    }

    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests');
    });

    it('returns 403 when non-admin', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue(null as never);

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 400 for invalid UUID', async () => {
      const req = createRequest('POST', '/api/admin/users/bad-id/unsuspend');
      const res = await unsuspendHandler(req, createParamsContext('bad-id'));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid user ID');
    });

    it('returns 404 when target user not found', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('User not found');
    });

    it('returns 200 on successful unsuspension', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: VALID_UUID } },
        error: null,
      });
      mockAdminClient.auth.admin.updateUserById.mockResolvedValue({
        data: { user: {} },
        error: null,
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('User unsuspended');
      expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith(VALID_UUID, {
        ban_duration: 'none',
      });
    });

    it('returns 500 on unban error', async () => {
      mockAdminClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: VALID_UUID } },
        error: null,
      });
      mockAdminClient.auth.admin.updateUserById.mockResolvedValue({
        data: null,
        error: { message: 'Unban failed' },
      });

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to unsuspend user');
    });

    it('returns 500 on unexpected exception', async () => {
      mockAdminClient.auth.admin.getUserById.mockRejectedValue(new Error('Crash'));

      const req = createRequest('POST', `/api/admin/users/${VALID_UUID}/unsuspend`);
      const res = await unsuspendHandler(req, createParamsContext(VALID_UUID));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to unsuspend user');
    });
  });

  // ─── GET /api/admin/stats ─────────────────────────────────────────
  describe('GET /api/admin/stats', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests');
    });

    it('returns 403 when non-admin', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue({
        id: 'user-1',
        role: 'client',
      } as never);

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 403 when profile is null', async () => {
      vi.mocked(serverAuth.getProfile).mockResolvedValue(null as never);

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('returns 200 with system stats', async () => {
      // The stats route calls supabase.from() 8 times via Promise.all
      // Each returns { count, error: null }
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
          is: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ count: 8, error: null }),
          }),
          in: vi.fn().mockResolvedValue({ count: 2, error: null }),
          // For the simple count queries (no chained filters after select)
          then: undefined,
        }),
      });

      // We need a more granular mock since different tables have different chains.
      // Let's override with mockImplementation for proper handling.
      mockFrom.mockImplementation((table: string) => {
        const baseSelect = vi.fn();

        if (table === 'profiles') {
          // Three different profile queries:
          // 1) total: select('*', { count: 'exact', head: true })
          // 2) this month: .gte(...)
          // 3) last month: .gte(...).lt(...)
          baseSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: 3, error: null }),
              // When no .lt() is chained, the gte itself resolves
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 5, error: null }),
            }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 50, error: null }),
          });
          return { select: baseSelect };
        }

        if (table === 'cases') {
          // Two case queries:
          // 1) total cases: .is('deleted_at', null)
          // 2) active cases: .is(...).not(...)
          baseSelect.mockReturnValue({
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: 8, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 20, error: null }),
            }),
          });
          return { select: baseSelect };
        }

        if (table === 'documents') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 100, error: null }),
          });
          return { select: baseSelect };
        }

        if (table === 'subscriptions') {
          // Two subscription queries:
          // 1) total: select(*)
          // 2) active: .in('status', [...])
          baseSelect.mockReturnValue({
            in: vi.fn().mockResolvedValue({ count: 10, error: null }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 15, error: null }),
          });
          return { select: baseSelect };
        }

        return { select: baseSelect };
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('totalUsers');
      expect(json.data).toHaveProperty('totalCases');
      expect(json.data).toHaveProperty('activeCases');
      expect(json.data).toHaveProperty('totalDocuments');
      expect(json.data).toHaveProperty('totalSubscriptions');
      expect(json.data).toHaveProperty('activeSubscriptions');
      expect(json.data).toHaveProperty('mrr');
      expect(json.data).toHaveProperty('mrrGrowth');
    });

    it('returns mrr: 0 when Stripe is not configured', async () => {
      // Stripe returns null (not configured)
      vi.mocked(getStripeClient).mockReturnValue(null);

      mockFrom.mockImplementation((table: string) => {
        const baseSelect = vi.fn();
        if (table === 'profiles') {
          baseSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 1, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'cases') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
          });
          return { select: baseSelect };
        }
        if (table === 'documents') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'subscriptions') {
          baseSelect.mockReturnValue({
            in: vi.fn().mockResolvedValue({ count: 0, error: null }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        return { select: baseSelect };
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.mrr).toBe(0);
      expect(json.data.mrrGrowth).toBeNull();
    });

    it('calculates MRR from active Stripe subscriptions (monthly)', async () => {
      const subItems = [
        {
          items: {
            data: [{ price: { unit_amount: 4900, recurring: { interval: 'month' } } }],
          },
        },
        {
          items: {
            data: [{ price: { unit_amount: 14900, recurring: { interval: 'month' } } }],
          },
        },
      ];
      const mockStripe = {
        subscriptions: {
          list: vi.fn().mockReturnValue({
            data: subItems,
            async *[Symbol.asyncIterator]() { for (const s of subItems) yield s; },
          }),
        },
      };
      vi.mocked(getStripeClient).mockReturnValue(mockStripe as never);

      mockFrom.mockImplementation((table: string) => {
        const baseSelect = vi.fn();
        if (table === 'profiles') {
          baseSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 2, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'cases') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
          });
          return { select: baseSelect };
        }
        if (table === 'documents') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'subscriptions') {
          baseSelect.mockReturnValue({
            in: vi.fn().mockResolvedValue({ count: 2, error: null }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 2, error: null }),
          });
          return { select: baseSelect };
        }
        return { select: baseSelect };
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      // 4900 + 14900 = 19800 cents
      expect(json.data.mrr).toBe(19800);
    });

    it('normalizes yearly subscriptions to monthly MRR', async () => {
      const subItems = [
        {
          items: {
            data: [{ price: { unit_amount: 47000, recurring: { interval: 'year' } } }],
          },
        },
      ];
      const mockStripe = {
        subscriptions: {
          list: vi.fn().mockReturnValue({
            data: subItems,
            async *[Symbol.asyncIterator]() { for (const s of subItems) yield s; },
          }),
        },
      };
      vi.mocked(getStripeClient).mockReturnValue(mockStripe as never);

      mockFrom.mockImplementation((table: string) => {
        const baseSelect = vi.fn();
        if (table === 'profiles') {
          baseSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 1, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'cases') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
          });
          return { select: baseSelect };
        }
        if (table === 'documents') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'subscriptions') {
          baseSelect.mockReturnValue({
            in: vi.fn().mockResolvedValue({ count: 1, error: null }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 1, error: null }),
          });
          return { select: baseSelect };
        }
        return { select: baseSelect };
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      // 47000 / 12 = 3917 (rounded)
      expect(json.data.mrr).toBe(Math.round(47000 / 12));
    });

    it('returns mrr: 0 when Stripe call fails (graceful degradation)', async () => {
      const mockStripe = {
        subscriptions: {
          list: vi.fn().mockReturnValue({
            async *[Symbol.asyncIterator]() { throw new Error('Stripe API error'); },
          }),
        },
      };
      vi.mocked(getStripeClient).mockReturnValue(mockStripe as never);

      mockFrom.mockImplementation((table: string) => {
        const baseSelect = vi.fn();
        if (table === 'profiles') {
          baseSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 1, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'cases') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ count: 0, error: null }),
              then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
            }),
          });
          return { select: baseSelect };
        }
        if (table === 'documents') {
          baseSelect.mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        if (table === 'subscriptions') {
          baseSelect.mockReturnValue({
            in: vi.fn().mockResolvedValue({ count: 0, error: null }),
            then: (resolve: (val: { count: number; error: null }) => void) => resolve({ count: 0, error: null }),
          });
          return { select: baseSelect };
        }
        return { select: baseSelect };
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.mrr).toBe(0);
      expect(json.data.mrrGrowth).toBeNull();
    });

    it('returns 500 on error', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('DB crash');
      });

      const req = createRequest('GET', '/api/admin/stats');
      const res = await statsHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to fetch admin stats');
    });
  });
});
