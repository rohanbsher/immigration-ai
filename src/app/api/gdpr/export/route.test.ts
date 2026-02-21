/**
 * Tests for GDPR Export API route.
 *
 * Covers:
 * - GET  /api/gdpr/export - List export jobs
 * - POST /api/gdpr/export - Create new export
 * - Authentication, rate limiting, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase client — needs auth.getUser (for withAuth) plus from/rpc (for route logic)
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
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

import { GET, POST } from './route';
import { getProfileAsAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { createMockChain } from '@/test-utils/mock-supabase-chain';

function createRequest(method: string, body?: Record<string, unknown>) {
  const init: RequestInit = { method, headers: { 'x-forwarded-for': '127.0.0.1' } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  return new NextRequest('http://localhost:3000/api/gdpr/export', init);
}

describe('GDPR Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // withAuth: authenticate user via supabase.auth.getUser
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    // withAuth: getProfileAsAdmin after auth
    vi.mocked(getProfileAsAdmin).mockResolvedValue({
      profile: { id: 'user-1', role: 'attorney', full_name: 'Test User', email: 'test@example.com' },
      error: null,
    } as any);

    // withAuth: rateLimit
    vi.mocked(rateLimit).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/gdpr/export', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 60 });

      const response = await GET(createRequest('GET'));

      expect(response.status).toBe(429);
    });

    it('returns 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 with job list', async () => {
      const jobs = [
        { id: 'job-1', status: 'completed', created_at: '2026-01-01' },
        { id: 'job-2', status: 'pending', created_at: '2026-01-02' },
      ];
      const chain = createMockChain({ data: jobs, error: null });
      mockSupabaseClient.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(jobs);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('gdpr_export_jobs');
    });

    it('returns 200 with empty array when no jobs', async () => {
      const chain = createMockChain({ data: [], error: null });
      mockSupabaseClient.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
    });

    it('returns 500 on DB error', async () => {
      const chain = createMockChain({ data: null, error: { message: 'connection refused' } });
      mockSupabaseClient.from.mockReturnValue(chain);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch export history');
    });

    it('rate limits by user.id not IP', async () => {
      const chain = createMockChain({ data: [], error: null });
      mockSupabaseClient.from.mockReturnValue(chain);

      await GET(createRequest('GET'));

      // withAuth calls rateLimit with the SENSITIVE config and user.id
      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'sensitive' }),
        'user-1'
      );
    });
  });

  describe('POST /api/gdpr/export', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 60 });

      const response = await POST(createRequest('POST'));

      expect(response.status).toBe(429);
    });

    it('returns 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when existing job is in progress', async () => {
      const checkChain = createMockChain({
        data: { id: 'existing-job', status: 'pending' },
        error: null,
      });
      mockSupabaseClient.from.mockReturnValue(checkChain);

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('An export job is already in progress');
    });

    it('returns 200 on success - creates job, fetches data, updates status', async () => {
      const checkChain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      const updateChain = createMockChain({ data: null, error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: { profile: { name: 'Test' }, cases: [] }, error: null });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.jobId).toBe('job-1');
      expect(data.data.exportData).toEqual({ profile: { name: 'Test' }, cases: [] });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_gdpr_export_job', { p_user_id: 'user-1' });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_user_export_data', { p_user_id: 'user-1' });
    });

    it('returns 500 when create_gdpr_export_job RPC fails', async () => {
      const checkChain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      mockSupabaseClient.from.mockReturnValue(checkChain);

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC function not found' },
      });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create export');
    });

    it('returns 500 when get_user_export_data RPC fails', async () => {
      const checkChain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      mockSupabaseClient.from.mockReturnValue(checkChain);

      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'export function failed' } });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create export');
    });

    it('still returns 200 when status update fails (logs error)', async () => {
      const checkChain = createMockChain({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      const updateChain = createMockChain({
        data: null,
        error: { message: 'update failed' },
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(checkChain)
        .mockReturnValueOnce(updateChain);

      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: { profile: {} }, error: null });

      const response = await POST(createRequest('POST'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.jobId).toBe('job-1');
    });
  });
});
