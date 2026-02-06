/**
 * Tests for GDPR Delete API route.
 *
 * Covers:
 * - GET    /api/gdpr/delete - Check pending deletion request
 * - POST   /api/gdpr/delete - Request account deletion
 * - DELETE /api/gdpr/delete - Cancel deletion request
 * - Authentication, rate limiting, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

import { GET, POST, DELETE } from './route';
import { serverAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { createMockChain, createMockSupabaseFrom } from '@/test-utils/mock-supabase-chain';

function createRequest(method: string, body?: Record<string, unknown>) {
  const init: RequestInit = { method, headers: { 'x-forwarded-for': '127.0.0.1' } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  return new NextRequest('http://localhost:3000/api/gdpr/delete', init);
}

describe('GDPR Delete API', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseFrom>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 });
    vi.mocked(serverAuth.getUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as never);
    mockSupabase = createMockSupabaseFrom();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/gdpr/delete', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 with pending request data', async () => {
      const pendingRequest = {
        id: 'req-1',
        user_id: 'user-1',
        status: 'pending',
        scheduled_for: '2026-03-01',
      };
      const chain = createMockChain({ data: pendingRequest, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(pendingRequest);
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_deletion_requests');
    });

    it('returns 200 with data: null when no pending request (PGRST116)', async () => {
      const chain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeNull();
    });

    it('returns 500 on DB error', async () => {
      const chain = createMockChain({
        data: null,
        error: { code: 'INTERNAL', message: 'connection refused' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch deletion request');
    });
  });

  describe('POST /api/gdpr/delete', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 60 });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 on success via request_account_deletion RPC', async () => {
      const rpcResult = {
        id: 'del-1',
        scheduled_for: '2026-03-08T00:00:00Z',
      };
      mockSupabase.rpc.mockResolvedValue({ data: rpcResult, error: null });

      const response = await POST(createRequest('POST', { reason: 'No longer needed' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('del-1');
      expect(data.data.scheduledFor).toBe('2026-03-08T00:00:00Z');
      expect(data.data.message).toContain('30 days');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('request_account_deletion', {
        p_user_id: 'user-1',
        p_reason: 'No longer needed',
        p_grace_period_days: 30,
      });
    });

    it('returns 400 when already pending', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Deletion request already pending for this user' },
      });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('A deletion request is already pending');
    });

    it('returns 500 on RPC error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database timeout' },
      });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to request deletion');
    });
  });

  describe('DELETE /api/gdpr/delete', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const response = await DELETE(createRequest('DELETE'));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const response = await DELETE(createRequest('DELETE'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 on success via cancel_deletion_request RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const response = await DELETE(createRequest('DELETE', { reason: 'Changed my mind' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.cancelled).toBe(true);
      expect(data.data.message).toContain('cancelled');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_deletion_request', {
        p_user_id: 'user-1',
        p_reason: 'Changed my mind',
      });
    });

    it('returns 404 when RPC returns null (no pending request)', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const response = await DELETE(createRequest('DELETE'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No pending deletion request found');
    });

    it('returns 500 on RPC error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed' },
      });

      const response = await DELETE(createRequest('DELETE'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to cancel deletion');
    });
  });
});
