/**
 * Integration tests for Notifications API routes.
 *
 * Tests cover:
 * - GET /api/notifications - List notifications (withAuth wrapper from @/lib/api)
 * - PATCH /api/notifications/[id] - Mark notification as read
 * - DELETE /api/notifications/[id] - Delete notification
 * - GET /api/notifications/count - Get unread count
 * - POST /api/notifications/mark-all-read - Mark all as read
 * - GET /api/notifications/preferences - Get preferences
 * - PATCH /api/notifications/preferences - Update preferences
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUserId = 'user-123';
const mockNotificationId = 'notif-abc';

const mockNotifications = [
  {
    id: 'notif-1',
    user_id: mockUserId,
    title: 'Doc uploaded',
    message: 'A document was uploaded',
    type: 'info',
    read: false,
    action_url: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'notif-2',
    user_id: mockUserId,
    title: 'Deadline',
    message: 'Deadline approaching',
    type: 'warning',
    read: true,
    action_url: '/dashboard/cases/1',
    created_at: '2024-01-02T00:00:00Z',
  },
];

const mockPreferences = {
  email_case_updates: true,
  email_deadline_reminders: true,
  email_document_uploads: false,
  email_form_updates: true,
  email_team_updates: false,
  email_billing_updates: true,
  email_marketing: false,
};

// ---------------------------------------------------------------------------
// Mock the supabase client used by count, mark-all-read, [id], preferences
// ---------------------------------------------------------------------------

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// ---------------------------------------------------------------------------
// Mock db services
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  notificationsService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/lib/api (withAuth wrapper used by GET /api/notifications)
// ---------------------------------------------------------------------------

vi.mock('@/lib/api', () => {
  const authenticateFn = vi.fn();

  const withAuth = (handler: any, options?: any) => {
    return async (request: any, context: any) => {
      const auth = await authenticateFn(request, options);
      if (!auth.success) {
        return auth.response;
      }
      try {
        const result = await handler(request, context, auth);
        // The handler returns { data: ... } — wrap in NextResponse
        if (result && typeof result === 'object' && !('status' in result)) {
          const { NextResponse } = await import('next/server');
          return NextResponse.json({ success: true, ...result });
        }
        return result;
      } catch (error: any) {
        const { NextResponse } = await import('next/server');
        return NextResponse.json(
          { success: false, error: error.message || 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };

  return {
    withAuth,
    withAttorneyAuth: (handler: any) => withAuth(handler, { roles: ['attorney'] }),
    apiHandler: (handler: any) => handler,
    _authenticate: authenticateFn,
  };
});

// ---------------------------------------------------------------------------
// Mock auth (used by preferences)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  serverAuth: {
    getUser: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock email (used by preferences)
// ---------------------------------------------------------------------------

vi.mock('@/lib/email', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock rate limiter
// ---------------------------------------------------------------------------

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
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

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

import { GET as getNotifications } from './route';
import { PATCH as patchNotification, DELETE as deleteNotification } from './[id]/route';
import { GET as getNotificationCount } from './count/route';
import { POST as markAllRead } from './mark-all-read/route';
import { GET as getPreferences, PATCH as patchPreferences } from './preferences/route';

import { notificationsService } from '@/lib/db';
import { standardRateLimiter, sensitiveRateLimiter } from '@/lib/rate-limit';
import { serverAuth } from '@/lib/auth';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';

// Access the internal authenticate mock from @/lib/api
const { _authenticate } = await import('@/lib/api') as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
) {
  const init: RequestInit = {
    method,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const req = new NextRequest(`http://localhost:3000${url}`, init);
  if (body) {
    req.json = async () => body;
  }
  return req;
}

function mockAuthSuccess() {
  return {
    success: true,
    user: { id: mockUserId, email: 'test@example.com' },
    profile: { id: mockUserId, email: 'test@example.com', role: 'attorney' },
  };
}

function mockAuthFailure(status = 401, error = 'Unauthorized') {
  return {
    success: false,
    error,
    response: new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notifications API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId, email: 'test@example.com' } },
      error: null,
    });

    // Default rate limit: allow
    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);
    vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/notifications (uses withAuth from @/lib/api)
  // ==========================================================================
  describe('GET /api/notifications', () => {
    it('should return 401 when not authenticated', async () => {
      _authenticate.mockResolvedValue(mockAuthFailure());

      const request = createRequest('GET', '/api/notifications');
      const response = await getNotifications(request, {});
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 200 with notifications list', async () => {
      _authenticate.mockResolvedValue(mockAuthSuccess());
      vi.mocked(notificationsService.getNotifications).mockResolvedValue(mockNotifications as any);

      const request = createRequest('GET', '/api/notifications');
      const response = await getNotifications(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        { unreadOnly: false, limit: 50 }
      );
    });

    it('should respect unread=true query param', async () => {
      _authenticate.mockResolvedValue(mockAuthSuccess());
      vi.mocked(notificationsService.getNotifications).mockResolvedValue([mockNotifications[0]] as any);

      const request = createRequest('GET', '/api/notifications?unread=true');
      const response = await getNotifications(request, {});

      expect(response.status).toBe(200);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        { unreadOnly: true, limit: 50 }
      );
    });

    it('should respect limit param capped at 100', async () => {
      _authenticate.mockResolvedValue(mockAuthSuccess());
      vi.mocked(notificationsService.getNotifications).mockResolvedValue([] as any);

      const request = createRequest('GET', '/api/notifications?limit=200');
      const response = await getNotifications(request, {});

      expect(response.status).toBe(200);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        { unreadOnly: false, limit: 100 }
      );
    });

    it('should default limit to 50 for invalid value', async () => {
      _authenticate.mockResolvedValue(mockAuthSuccess());
      vi.mocked(notificationsService.getNotifications).mockResolvedValue([] as any);

      const request = createRequest('GET', '/api/notifications?limit=abc');
      const response = await getNotifications(request, {});

      expect(response.status).toBe(200);
      expect(notificationsService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        { unreadOnly: false, limit: 50 }
      );
    });

    it('should return 500 on service error', async () => {
      _authenticate.mockResolvedValue(mockAuthSuccess());
      vi.mocked(notificationsService.getNotifications).mockRejectedValue(new Error('DB error'));

      const request = createRequest('GET', '/api/notifications');
      const response = await getNotifications(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  // ==========================================================================
  // PATCH /api/notifications/[id]
  // ==========================================================================
  describe('PATCH /api/notifications/[id]', () => {
    const makeParams = (id: string = mockNotificationId) => ({
      params: Promise.resolve({ id }),
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: true });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when notification not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: true });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Notification not found');
    });

    it('should return 403 when notification belongs to another user', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'other-user' },
          error: null,
        }),
      });

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: true });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('You can only modify your own notifications');
    });

    it('should return 200 on mark as read', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });
      vi.mocked(notificationsService.markAsRead).mockResolvedValue(undefined);

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: true });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(mockNotificationId);
    });

    it('should not call markAsRead when read=false', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: false });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(notificationsService.markAsRead).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid body (Zod)', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: 'not-a-bool' } as any);
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 500 on service error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });
      vi.mocked(notificationsService.markAsRead).mockRejectedValue(new Error('DB fail'));

      const request = createRequest('PATCH', `/api/notifications/${mockNotificationId}`, { read: true });
      const response = await patchNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update notification');
    });
  });

  // ==========================================================================
  // DELETE /api/notifications/[id]
  // ==========================================================================
  describe('DELETE /api/notifications/[id]', () => {
    const makeParams = (id: string = mockNotificationId) => ({
      params: Promise.resolve({ id }),
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('DELETE', `/api/notifications/${mockNotificationId}`);
      const response = await deleteNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when notification not found', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const request = createRequest('DELETE', `/api/notifications/${mockNotificationId}`);
      const response = await deleteNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Notification not found');
    });

    it('should return 403 when notification belongs to another user', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'other-user' },
          error: null,
        }),
      });

      const request = createRequest('DELETE', `/api/notifications/${mockNotificationId}`);
      const response = await deleteNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('You can only delete your own notifications');
    });

    it('should return 200 on successful delete', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });
      vi.mocked(notificationsService.deleteNotification).mockResolvedValue(undefined);

      const request = createRequest('DELETE', `/api/notifications/${mockNotificationId}`);
      const response = await deleteNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Notification deleted successfully');
      expect(notificationsService.deleteNotification).toHaveBeenCalledWith(mockNotificationId);
    });

    it('should return 500 on service error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: mockUserId },
          error: null,
        }),
      });
      vi.mocked(notificationsService.deleteNotification).mockRejectedValue(new Error('DB fail'));

      const request = createRequest('DELETE', `/api/notifications/${mockNotificationId}`);
      const response = await deleteNotification(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete notification');
    });
  });

  // ==========================================================================
  // GET /api/notifications/count
  // ==========================================================================
  describe('GET /api/notifications/count', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('GET', '/api/notifications/count');
      const response = await getNotificationCount(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as any);

      const request = createRequest('GET', '/api/notifications/count');
      const response = await getNotificationCount(request);

      expect(response.status).toBe(429);
    });

    it('should return 200 with unread count', async () => {
      vi.mocked(notificationsService.getUnreadCount).mockResolvedValue(5);

      const request = createRequest('GET', '/api/notifications/count');
      const response = await getNotificationCount(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(5);
    });

    it('should return 500 on error', async () => {
      vi.mocked(notificationsService.getUnreadCount).mockRejectedValue(new Error('DB error'));

      const request = createRequest('GET', '/api/notifications/count');
      const response = await getNotificationCount(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch notification count');
    });
  });

  // ==========================================================================
  // POST /api/notifications/mark-all-read
  // ==========================================================================
  describe('POST /api/notifications/mark-all-read', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('POST', '/api/notifications/mark-all-read');
      const response = await markAllRead(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 200 on success', async () => {
      vi.mocked(notificationsService.markAllAsRead).mockResolvedValue(undefined);

      const request = createRequest('POST', '/api/notifications/mark-all-read');
      const response = await markAllRead(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 500 on error', async () => {
      vi.mocked(notificationsService.markAllAsRead).mockRejectedValue(new Error('DB fail'));

      const request = createRequest('POST', '/api/notifications/mark-all-read');
      const response = await markAllRead(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to mark all notifications as read');
    });
  });

  // ==========================================================================
  // GET /api/notifications/preferences
  // ==========================================================================
  describe('GET /api/notifications/preferences', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as any);

      const request = createRequest('GET', '/api/notifications/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 30 } as any);

      const request = createRequest('GET', '/api/notifications/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should return 200 with preferences', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue({ id: mockUserId, email: 'test@example.com' } as any);
      vi.mocked(getNotificationPreferences).mockResolvedValue(mockPreferences as any);

      const request = createRequest('GET', '/api/notifications/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockPreferences);
    });

    it('should return 500 on error', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue({ id: mockUserId, email: 'test@example.com' } as any);
      vi.mocked(getNotificationPreferences).mockRejectedValue(new Error('DB error'));

      const request = createRequest('GET', '/api/notifications/preferences');
      const response = await getPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch notification preferences');
    });
  });

  // ==========================================================================
  // PATCH /api/notifications/preferences
  // ==========================================================================
  describe('PATCH /api/notifications/preferences', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as any);

      const request = createRequest('PATCH', '/api/notifications/preferences', {
        email_case_updates: false,
      });
      const response = await patchPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 60 } as any);

      const request = createRequest('PATCH', '/api/notifications/preferences', {
        email_case_updates: false,
      });
      const response = await patchPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should return 400 for invalid Zod schema', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue({ id: mockUserId, email: 'test@example.com' } as any);

      const request = createRequest('PATCH', '/api/notifications/preferences', {
        email_case_updates: 'not-a-boolean',
      } as any);
      const response = await patchPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 200 with updated preferences', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue({ id: mockUserId, email: 'test@example.com' } as any);
      const updated = { ...mockPreferences, email_case_updates: false };
      vi.mocked(updateNotificationPreferences).mockResolvedValue(updated as any);

      const request = createRequest('PATCH', '/api/notifications/preferences', {
        email_case_updates: false,
      });
      const response = await patchPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.email_case_updates).toBe(false);
      expect(updateNotificationPreferences).toHaveBeenCalledWith(mockUserId, {
        email_case_updates: false,
      });
    });

    it('should return 500 on error', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
      vi.mocked(serverAuth.getUser).mockResolvedValue({ id: mockUserId, email: 'test@example.com' } as any);
      vi.mocked(updateNotificationPreferences).mockRejectedValue(new Error('DB error'));

      const request = createRequest('PATCH', '/api/notifications/preferences', {
        email_case_updates: false,
      });
      const response = await patchPreferences(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update notification preferences');
    });
  });
});
