/**
 * Integration tests for Health API route.
 *
 * Tests cover:
 * - GET /api/health - Basic health check (no x-health-detail)
 * - GET /api/health - Detailed check without auth (returns basic)
 * - GET /api/health - Detailed check with valid auth (returns full checks)
 * - Database check scenarios (pass, warn, fail)
 * - Environment check scenarios (pass, warn, fail)
 * - Redis check mapping
 * - External services check
 * - Overall status aggregation (healthy, degraded, unhealthy)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin (health uses getAdminClient for DB check)
// ---------------------------------------------------------------------------

const { mockSupabaseFrom } = vi.hoisted(() => {
  const mockSupabaseFrom = vi.fn();
  return { mockSupabaseFrom };
});

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn().mockReturnValue({
    from: mockSupabaseFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Mock Redis health
// ---------------------------------------------------------------------------

vi.mock('@/lib/rate-limit/health', () => ({
  getDetailedRedisHealth: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock timing-safe comparison
// ---------------------------------------------------------------------------

vi.mock('@/lib/security/timing-safe', () => ({
  safeCompareSecrets: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from './route';
import { getDetailedRedisHealth } from '@/lib/rate-limit/health';
import { safeCompareSecrets } from '@/lib/security/timing-safe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers?: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/health', {
    method: 'GET',
    headers: { ...headers },
  });
}

function createHealthyRedisResponse() {
  return {
    status: 'healthy',
    metrics: {
      connected: true,
      latency: 10,
      error: null,
      provider: 'upstash',
      lastChecked: new Date().toISOString(),
    },
    rateLimitInfo: {
      totalKeys: 5,
      memoryUsage: null,
      provider: 'upstash',
      configured: true,
    },
    recommendations: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Health API Route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default env vars
    process.env.npm_package_version = '1.0.0';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    process.env.OPENAI_API_KEY = 'test-openai';
    process.env.STRIPE_SECRET_KEY = 'test-stripe';
    process.env.RESEND_API_KEY = 'test-resend';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore env
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // Basic health check (no x-health-detail header)
  // ==========================================================================
  describe('Basic health check', () => {
    it('should return status, timestamp, version, and uptime', async () => {
      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBe('1.0.0');
      expect(typeof data.uptime).toBe('number');
      expect(data.checks).toBeUndefined();
    });

    it('should use default version when npm_package_version is not set', async () => {
      delete process.env.npm_package_version;

      const request = createRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.version).toBe('0.1.0');
    });

    it('should include Cache-Control header', async () => {
      const request = createRequest();
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    });
  });

  // ==========================================================================
  // Detailed check without auth (returns basic)
  // ==========================================================================
  describe('Detailed check without auth', () => {
    it('should return basic response without checks when not authenticated', async () => {
      vi.mocked(safeCompareSecrets).mockReturnValue(false);

      const request = createRequest({ 'x-health-detail': 'true' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.checks).toBeUndefined();
    });

    it('should return basic response when no auth header provided', async () => {
      vi.mocked(safeCompareSecrets).mockReturnValue(false);

      const request = createRequest({ 'x-health-detail': 'true' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.checks).toBeUndefined();
    });
  });

  // ==========================================================================
  // Detailed check with valid auth
  // ==========================================================================
  describe('Detailed check with valid auth', () => {
    beforeEach(() => {
      vi.mocked(safeCompareSecrets).mockReturnValue(true);
    });

    it('should return full checks when authenticated', async () => {
      // DB check: pass (fast)
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });

      // Redis check: healthy
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.environment).toBeDefined();
      expect(data.checks.redis).toBeDefined();
      expect(data.checks.externalServices).toBeDefined();
    });

    it('should include X-Health-Check-Duration header', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);

      expect(response.headers.get('X-Health-Check-Duration')).toMatch(/\d+ms/);
    });

    // ------------ Database checks ------------------------------------------------

    it('should report database pass when query is fast', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.database.status).toBe('pass');
      expect(data.checks.database.message).toBe('Database connection healthy');
    });

    it('should report database fail when query errors', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection refused' } }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.database.status).toBe('fail');
      expect(data.checks.database.message).toBe('Database query failed');
    });

    it('should report database fail when supabase throws', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.database.status).toBe('fail');
      expect(data.checks.database.message).toBe('Database connection failed');
    });

    // ------------ Environment checks ---------------------------------------------

    it('should report environment pass when all vars set', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.environment.status).toBe('pass');
      expect(data.checks.environment.message).toBe('All environment variables configured');
    });

    it('should report environment warn when optional vars missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.environment.status).toBe('warn');
      expect(data.checks.environment.message).toContain('optional service(s) not configured');
    });

    it('should report environment fail when required vars missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.environment.status).toBe('fail');
      expect(data.checks.environment.message).toContain('required environment variable(s) missing');
    });

    // ------------ Redis checks ---------------------------------------------------

    it('should map redis healthy status to pass', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.redis.status).toBe('pass');
    });

    it('should map redis degraded status to warn', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue({
        status: 'degraded',
        metrics: {
          connected: true,
          latency: 600,
          error: null,
          provider: 'upstash',
          lastChecked: new Date().toISOString(),
        },
        rateLimitInfo: {
          totalKeys: 5,
          memoryUsage: null,
          provider: 'upstash',
          configured: true,
        },
        recommendations: ['Redis latency is high'],
      } as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.redis.status).toBe('warn');
    });

    it('should map redis unhealthy status to fail', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue({
        status: 'unhealthy',
        metrics: {
          connected: false,
          latency: null,
          error: 'Connection refused',
          provider: 'upstash',
          lastChecked: new Date().toISOString(),
        },
        rateLimitInfo: {
          totalKeys: null,
          memoryUsage: null,
          provider: 'upstash',
          configured: true,
        },
        recommendations: ['Check Redis credentials'],
      } as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.redis.status).toBe('fail');
    });

    it('should handle redis health check exception', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockRejectedValue(new Error('Redis exploded'));

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.redis.status).toBe('fail');
      expect(data.checks.redis.message).toBe('Redis health check failed');
    });

    // ------------ External services checks ---------------------------------------

    it('should report external services pass when all configured', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.externalServices.status).toBe('pass');
      expect(data.checks.externalServices.message).toBe('All external services configured');
    });

    it('should report external services warn when some not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.RESEND_API_KEY;

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.externalServices.status).toBe('warn');
      expect(data.checks.externalServices.message).toBe('Some external services not configured');
    });

    it('should report external services warn when none configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.RESEND_API_KEY;

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.externalServices.status).toBe('warn');
      expect(data.checks.externalServices.message).toBe('No external services configured');
    });

    // ------------ Overall status aggregation -------------------------------------

    it('should be healthy when all checks pass', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });

    it('should be degraded when any check warns', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
    });

    it('should be unhealthy with 503 when any check fails', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });
      vi.mocked(getDetailedRedisHealth).mockResolvedValue(createHealthyRedisResponse() as any);

      const request = createRequest({
        'x-health-detail': 'true',
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
    });
  });
});
