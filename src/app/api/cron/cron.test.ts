/**
 * Integration tests for Cron API routes.
 *
 * Tests cover:
 * - GET /api/cron/deadline-alerts - Sync deadline alerts (Vercel Cron sends GET)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/deadline', () => ({
  syncDeadlineAlerts: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  serverEnv: {
    CRON_SECRET: 'test-cron-secret',
  },
  features: {
    cronJobs: true,
  },
}));

vi.mock('@/lib/security/timing-safe', () => ({
  safeCompare: vi.fn(),
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

import { GET } from './deadline-alerts/route';
import { syncDeadlineAlerts } from '@/lib/deadline';
import { features, serverEnv } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  headers?: Record<string, string>
) {
  return new NextRequest('http://localhost:3000/api/cron/deadline-alerts', {
    method,
    headers: { ...headers },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cron API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: cron jobs enabled, valid secret, successful sync
    vi.mocked(features).cronJobs = true;
    vi.mocked(serverEnv).CRON_SECRET = 'test-cron-secret';
    vi.mocked(safeCompare).mockReturnValue(true);
    vi.mocked(syncDeadlineAlerts).mockResolvedValue(5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/cron/deadline-alerts (Vercel Cron sends GET)
  // ==========================================================================
  describe('GET /api/cron/deadline-alerts', () => {
    it('should return 500 when CRON_SECRET not configured (cronJobs = false)', async () => {
      vi.mocked(features).cronJobs = false;

      const request = createRequest('GET', {
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Server configuration error');
    });

    it('should return 401 when no authorization header', async () => {
      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when invalid authorization token', async () => {
      vi.mocked(safeCompare).mockReturnValue(false);

      const request = createRequest('GET', {
        authorization: 'Bearer wrong-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should call safeCompare with correct arguments', async () => {
      const request = createRequest('GET', {
        authorization: 'Bearer test-cron-secret',
      });
      await GET(request);

      expect(safeCompare).toHaveBeenCalledWith(
        'Bearer test-cron-secret',
        'Bearer test-cron-secret'
      );
    });

    it('should return 200 with sync count on success', async () => {
      vi.mocked(syncDeadlineAlerts).mockResolvedValue(5);

      const request = createRequest('GET', {
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.syncCount).toBe(5);
      expect(data.message).toBe('Synced 5 deadline alerts');
      expect(data.timestamp).toBeDefined();
    });

    it('should return 200 with zero sync count', async () => {
      vi.mocked(syncDeadlineAlerts).mockResolvedValue(0);

      const request = createRequest('GET', {
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.syncCount).toBe(0);
      expect(data.message).toBe('Synced 0 deadline alerts');
    });

    it('should return 500 when syncDeadlineAlerts throws', async () => {
      vi.mocked(syncDeadlineAlerts).mockRejectedValue(new Error('Sync failed'));

      const request = createRequest('GET', {
        authorization: 'Bearer test-cron-secret',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to sync deadline alerts');
    });
  });

});
