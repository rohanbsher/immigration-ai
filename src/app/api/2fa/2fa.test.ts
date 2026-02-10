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

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
}));

vi.mock('@/lib/2fa', () => ({
  setupTwoFactor: vi.fn(),
  verifyAndEnableTwoFactor: vi.fn(),
  verifyTwoFactorToken: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  getTwoFactorStatus: vi.fn(),
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

// Import route handlers after mocking
import { POST as setupHandler } from './setup/route';
import { POST as verifyHandler } from './verify/route';
import { POST as disableHandler } from './disable/route';
import { POST as backupCodesHandler } from './backup-codes/route';
import { GET as statusHandler } from './status/route';

import { serverAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyTwoFactorToken,
  disableTwoFactor,
  regenerateBackupCodes,
  getTwoFactorStatus,
} from '@/lib/2fa';

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

describe('2FA API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows, user authenticated
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 });
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── POST /api/2fa/setup ────────────────────────────────────────────
  describe('POST /api/2fa/setup', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests. Please try again later.');
      expect(res.headers.get('Retry-After')).toBe('30');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 200 with QR code and backup codes on success', async () => {
      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 'test-secret',
        qrCodeDataUrl: 'data:image/png;base64,abc123',
        backupCodes: ['code1', 'code2', 'code3'],
      });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.qrCodeDataUrl).toBe('data:image/png;base64,abc123');
      expect(json.data.backupCodes).toEqual(['code1', 'code2', 'code3']);
      // Secret should NOT be in the response
      expect(json.data.secret).toBeUndefined();
    });

    it('returns 500 when setupTwoFactor throws', async () => {
      vi.mocked(setupTwoFactor).mockRejectedValue(new Error('DB failure'));

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to setup 2FA');
    });
  });

  // ─── POST /api/2fa/verify ──────────────────────────────────────────
  describe('POST /api/2fa/verify', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many attempts. Please try again later.');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid Zod schema (token too short)', async () => {
      const req = createRequest('POST', '/api/2fa/verify', { token: '123' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
      expect(json.details).toBeDefined();
    });

    it('returns 400 for invalid Zod schema (token too long)', async () => {
      const req = createRequest('POST', '/api/2fa/verify', { token: '123456789' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
    });

    it('returns 400 when verification code is invalid (isSetup=false)', async () => {
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(false);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456', isSetup: false });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid verification code');
      expect(vi.mocked(verifyTwoFactorToken)).toHaveBeenCalledWith('user-1', '123456');
    });

    it('returns 400 when setup verification fails (isSetup=true)', async () => {
      vi.mocked(verifyAndEnableTwoFactor).mockResolvedValue(false);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456', isSetup: true });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid verification code');
      expect(vi.mocked(verifyAndEnableTwoFactor)).toHaveBeenCalledWith('user-1', '123456');
    });

    it('returns 200 with verified=true on success (setup mode)', async () => {
      vi.mocked(verifyAndEnableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456', isSetup: true });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.verified).toBe(true);
      expect(json.data.message).toBe('2FA has been enabled');
    });

    it('returns 200 with verified=true on success (verify mode)', async () => {
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456', isSetup: false });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.verified).toBe(true);
      expect(json.data.message).toBe('Verification successful');
    });

    it('returns 500 on unexpected error', async () => {
      vi.mocked(verifyTwoFactorToken).mockRejectedValue(new Error('Unexpected'));

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Verification failed');
    });
  });

  // ─── POST /api/2fa/disable ─────────────────────────────────────────
  describe('POST /api/2fa/disable', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests. Please try again later.');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid Zod schema (token too short)', async () => {
      const req = createRequest('POST', '/api/2fa/disable', { token: '12' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
      expect(json.details).toBeDefined();
    });

    it('returns 400 when verification code is invalid', async () => {
      vi.mocked(disableTwoFactor).mockResolvedValue(false);

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid verification code');
    });

    it('returns 200 on success', async () => {
      vi.mocked(disableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.disabled).toBe(true);
      expect(json.data.message).toBe('2FA has been disabled');
    });

    it('returns 500 on error', async () => {
      vi.mocked(disableTwoFactor).mockRejectedValue(new Error('DB error'));

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to disable 2FA');
    });
  });

  // ─── POST /api/2fa/backup-codes ────────────────────────────────────
  describe('POST /api/2fa/backup-codes', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests. Please try again later.');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid Zod schema (token too long)', async () => {
      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '1234567' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
      expect(json.details).toBeDefined();
    });

    it('returns 400 for invalid Zod schema (token too short)', async () => {
      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '12345' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
    });

    it('returns 200 with new backup codes on success', async () => {
      const newCodes = ['aaa111', 'bbb222', 'ccc333'];
      vi.mocked(regenerateBackupCodes).mockResolvedValue(newCodes);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.backupCodes).toEqual(newCodes);
      expect(json.data.message).toBe('New backup codes generated. Previous codes are now invalid.');
    });

    it('returns 500 on error', async () => {
      vi.mocked(regenerateBackupCodes).mockRejectedValue(new Error('Failed'));

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to regenerate backup codes');
    });
  });

  // ─── GET /api/2fa/status ───────────────────────────────────────────
  describe('GET /api/2fa/status', () => {
    it('returns 429 when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.error).toBe('Too many requests. Please try again later.');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 200 with 2FA status (enabled)', async () => {
      vi.mocked(getTwoFactorStatus).mockResolvedValue({
        enabled: true,
        verified: true,
        lastUsedAt: '2026-01-01T00:00:00Z',
        backupCodesRemaining: 8,
      });

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.enabled).toBe(true);
      expect(json.data.verified).toBe(true);
      expect(json.data.backupCodesRemaining).toBe(8);
    });

    it('returns 200 with 2FA status (disabled)', async () => {
      vi.mocked(getTwoFactorStatus).mockResolvedValue({
        enabled: false,
        verified: false,
        lastUsedAt: null,
        backupCodesRemaining: 0,
      });

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.enabled).toBe(false);
    });

    it('returns 500 on error', async () => {
      vi.mocked(getTwoFactorStatus).mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to get 2FA status');
    });
  });
});
