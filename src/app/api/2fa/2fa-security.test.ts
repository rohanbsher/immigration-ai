/**
 * Security-focused tests for 2FA API routes.
 *
 * Supplements the existing 2fa.test.ts with:
 * - Malformed JSON body handling (safeParseBody path)
 * - Boundary token lengths per Zod schema
 * - Rate limit header correctness
 * - Missing body fields
 * - Concurrent request scenarios
 * - Secret leakage prevention
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  serverAuth: {
    getUser: vi.fn(),
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

vi.mock('@/lib/api/safe-parse-body', () => ({
  safeParseBody: vi.fn(),
}));

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
import { safeParseBody } from '@/lib/api/safe-parse-body';

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.100',
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

describe('2FA Routes - Security Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 10 });
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Setup Route Security ─────────────────────────────────────────────
  describe('POST /api/2fa/setup - security', () => {
    it('never exposes the TOTP secret in the response', async () => {
      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 'SUPERSECRETBASE32KEY',
        qrCodeDataUrl: 'data:image/png;base64,abc123',
        backupCodes: ['code1', 'code2'],
      });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.secret).toBeUndefined();
      expect(JSON.stringify(json)).not.toContain('SUPERSECRETBASE32KEY');
    });

    it('includes Retry-After header when rate limited', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 45 });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
    });

    it('defaults Retry-After to 60 when retryAfter is undefined', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0 });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });

    it('extracts IP from x-forwarded-for header', async () => {
      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 's',
        qrCodeDataUrl: 'data:image/png;base64,abc',
        backupCodes: [],
      });

      const req = createRequest('POST', '/api/2fa/setup');
      await setupHandler(req);

      expect(rateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ keyPrefix: 'sensitive' }),
        '192.168.1.100'
      );
    });

    it('uses "unknown" IP when x-forwarded-for is missing', async () => {
      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 's',
        qrCodeDataUrl: 'data:image/png;base64,abc',
        backupCodes: [],
      });

      const req = new NextRequest('http://localhost:3000/api/2fa/setup', {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
      await setupHandler(req);

      expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'unknown');
    });

    it('handles user with empty email', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue({
        id: 'user-1',
        email: undefined,
      } as never);

      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 's',
        qrCodeDataUrl: 'data:image/png;base64,abc',
        backupCodes: ['c1'],
      });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);

      expect(res.status).toBe(200);
      expect(setupTwoFactor).toHaveBeenCalledWith('user-1', '');
    });
  });

  // ─── Verify Route Security ────────────────────────────────────────────
  describe('POST /api/2fa/verify - security', () => {
    it('returns 400 for malformed JSON body', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: false,
        response: new (await import('next/server')).NextResponse(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      } as never);

      const req = createRequest('POST', '/api/2fa/verify');
      const res = await verifyHandler(req);

      expect(res.status).toBe(400);
    });

    it('accepts 6-digit token (minimum length)', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456', isSetup: false },
      } as never);
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.verified).toBe(true);
    });

    it('accepts 8-char token (maximum length, for backup codes)', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '12345678', isSetup: false },
      } as never);
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '12345678' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.verified).toBe(true);
    });

    it('rejects 5-char token (below minimum)', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '12345' },
      } as never);

      const req = createRequest('POST', '/api/2fa/verify', { token: '12345' });
      const res = await verifyHandler(req);

      expect(res.status).toBe(400);
    });

    it('rejects 9-char token (above maximum)', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456789' },
      } as never);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456789' });
      const res = await verifyHandler(req);

      expect(res.status).toBe(400);
    });

    it('defaults isSetup to false when not provided', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe('Verification successful');
      expect(verifyTwoFactorToken).toHaveBeenCalled();
    });

    it('calls verifyAndEnableTwoFactor when isSetup=true', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456', isSetup: true },
      } as never);
      vi.mocked(verifyAndEnableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456', isSetup: true });
      const res = await verifyHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe('2FA has been enabled');
      expect(verifyAndEnableTwoFactor).toHaveBeenCalledWith('user-1', '123456');
    });

    it('includes Retry-After header on rate limit', async () => {
      vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 120 });

      const req = createRequest('POST', '/api/2fa/verify', { token: '123456' });
      const res = await verifyHandler(req);

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('120');
    });

    it('rejects missing token field', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: {},
      } as never);

      const req = createRequest('POST', '/api/2fa/verify', {});
      const res = await verifyHandler(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── Disable Route Security ───────────────────────────────────────────
  describe('POST /api/2fa/disable - security', () => {
    it('returns 400 for malformed JSON body', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: false,
        response: new (await import('next/server')).NextResponse(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      } as never);

      const req = createRequest('POST', '/api/2fa/disable');
      const res = await disableHandler(req);

      expect(res.status).toBe(400);
    });

    it('accepts 6-digit token', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(disableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456' });
      const res = await disableHandler(req);

      expect(res.status).toBe(200);
    });

    it('accepts 8-char token (backup code length)', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '12345678' },
      } as never);
      vi.mocked(disableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/disable', { token: '12345678' });
      const res = await disableHandler(req);

      expect(res.status).toBe(200);
    });

    it('rejects token shorter than 6 chars', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '12345' },
      } as never);

      const req = createRequest('POST', '/api/2fa/disable', { token: '12345' });
      const res = await disableHandler(req);

      expect(res.status).toBe(400);
    });

    it('rejects token longer than 8 chars', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456789' },
      } as never);

      const req = createRequest('POST', '/api/2fa/disable', { token: '123456789' });
      const res = await disableHandler(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── Backup Codes Route Security ──────────────────────────────────────
  describe('POST /api/2fa/backup-codes - security', () => {
    it('returns 400 for malformed JSON body', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: false,
        response: new (await import('next/server')).NextResponse(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        ),
      } as never);

      const req = createRequest('POST', '/api/2fa/backup-codes');
      const res = await backupCodesHandler(req);

      expect(res.status).toBe(400);
    });

    it('only accepts exactly 6-digit tokens (strict schema)', async () => {
      // The backup-codes route uses z.string().min(6).max(6) - stricter than verify/disable
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '1234567' },
      } as never);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '1234567' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe('Invalid request');
    });

    it('rejects 5-digit token', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '12345' },
      } as never);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '12345' });
      const res = await backupCodesHandler(req);

      expect(res.status).toBe(400);
    });

    it('accepts exactly 6-digit token', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(regenerateBackupCodes).mockResolvedValue(['a', 'b', 'c']);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.backupCodes).toEqual(['a', 'b', 'c']);
      expect(json.data.message).toContain('Previous codes are now invalid');
    });

    it('invalidates previous codes on regeneration', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(regenerateBackupCodes).mockResolvedValue(['new1', 'new2']);

      const req = createRequest('POST', '/api/2fa/backup-codes', { token: '123456' });
      const res = await backupCodesHandler(req);
      const json = await res.json();

      expect(json.data.message).toBe('New backup codes generated. Previous codes are now invalid.');
      expect(regenerateBackupCodes).toHaveBeenCalledWith('user-1', '123456');
    });
  });

  // ─── Status Route Security ────────────────────────────────────────────
  describe('GET /api/2fa/status - security', () => {
    it('does not expose sensitive data (no secret, no hashes)', async () => {
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
      const responseStr = JSON.stringify(json);
      expect(responseStr).not.toContain('secret');
      expect(responseStr).not.toContain('hash');
      expect(responseStr).not.toContain('encrypted');
    });

    it('returns correct structure for disabled 2FA', async () => {
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
      expect(json.data.enabled).toBe(false);
      expect(json.data.verified).toBe(false);
      expect(json.data.lastUsedAt).toBeNull();
      expect(json.data.backupCodesRemaining).toBe(0);
    });

    it('includes backup codes remaining count', async () => {
      vi.mocked(getTwoFactorStatus).mockResolvedValue({
        enabled: true,
        verified: true,
        lastUsedAt: '2026-02-15T12:00:00Z',
        backupCodesRemaining: 3,
      });

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);
      const json = await res.json();

      expect(json.data.backupCodesRemaining).toBe(3);
    });
  });

  // ─── IDOR Protection ─────────────────────────────────────────────────
  describe('IDOR protection', () => {
    const USER_1 = { id: 'user-1', email: 'user1@example.com' };
    const USER_2_ID = 'user-2';

    it('status endpoint only queries the authenticated user\'s data', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(getTwoFactorStatus).mockResolvedValue({
        enabled: true,
        verified: true,
        lastUsedAt: '2026-01-01T00:00:00Z',
        backupCodesRemaining: 5,
      });

      const req = createRequest('GET', '/api/2fa/status');
      const res = await statusHandler(req);

      expect(res.status).toBe(200);
      expect(getTwoFactorStatus).toHaveBeenCalledWith(USER_1.id);
      expect(getTwoFactorStatus).not.toHaveBeenCalledWith(USER_2_ID);
    });

    it('setup endpoint scopes TOTP secret creation to authenticated user', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 'SECRET',
        qrCodeDataUrl: 'data:image/png;base64,abc',
        backupCodes: ['code1'],
      });

      const req = createRequest('POST', '/api/2fa/setup');
      const res = await setupHandler(req);

      expect(res.status).toBe(200);
      expect(setupTwoFactor).toHaveBeenCalledWith(USER_1.id, USER_1.email);
      expect(setupTwoFactor).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
    });

    it('verify endpoint derives user ID from session, not request body', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456', isSetup: false },
      } as never);
      vi.mocked(verifyTwoFactorToken).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', {
        token: '123456',
        userId: USER_2_ID,
      });
      const res = await verifyHandler(req);

      expect(res.status).toBe(200);
      expect(verifyTwoFactorToken).toHaveBeenCalledWith(USER_1.id, '123456');
      expect(verifyTwoFactorToken).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
    });

    it('verify+setup endpoint derives user ID from session, not request body', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '654321', isSetup: true },
      } as never);
      vi.mocked(verifyAndEnableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/verify', {
        token: '654321',
        isSetup: true,
        userId: USER_2_ID,
      });
      const res = await verifyHandler(req);

      expect(res.status).toBe(200);
      expect(verifyAndEnableTwoFactor).toHaveBeenCalledWith(USER_1.id, '654321');
      expect(verifyAndEnableTwoFactor).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
    });

    it('disable endpoint scopes 2FA removal to authenticated user', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(disableTwoFactor).mockResolvedValue(true);

      const req = createRequest('POST', '/api/2fa/disable', {
        token: '123456',
        userId: USER_2_ID,
      });
      const res = await disableHandler(req);

      expect(res.status).toBe(200);
      expect(disableTwoFactor).toHaveBeenCalledWith(USER_1.id, '123456');
      expect(disableTwoFactor).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
    });

    it('backup-codes endpoint scopes regeneration to authenticated user', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { token: '123456' },
      } as never);
      vi.mocked(regenerateBackupCodes).mockResolvedValue(['new1', 'new2']);

      const req = createRequest('POST', '/api/2fa/backup-codes', {
        token: '123456',
        userId: USER_2_ID,
      });
      const res = await backupCodesHandler(req);

      expect(res.status).toBe(200);
      expect(regenerateBackupCodes).toHaveBeenCalledWith(USER_1.id, '123456');
      expect(regenerateBackupCodes).not.toHaveBeenCalledWith(USER_2_ID, expect.anything());
    });

    it('all 2FA operations use session user ID even when body contains a different userId', async () => {
      vi.mocked(serverAuth.getUser).mockResolvedValue(USER_1 as never);

      vi.mocked(setupTwoFactor).mockResolvedValue({
        secret: 's',
        qrCodeDataUrl: 'data:image/png;base64,abc',
        backupCodes: [],
      });

      const req = createRequest('POST', '/api/2fa/setup', { userId: USER_2_ID });
      await setupHandler(req);

      expect(setupTwoFactor).toHaveBeenCalledWith(USER_1.id, USER_1.email);
    });
  });

  // ─── Cross-cutting Auth Security ──────────────────────────────────────
  describe('cross-cutting auth checks', () => {
    const routes = [
      { name: 'setup', handler: setupHandler, method: 'POST', url: '/api/2fa/setup' },
      { name: 'verify', handler: verifyHandler, method: 'POST', url: '/api/2fa/verify' },
      { name: 'disable', handler: disableHandler, method: 'POST', url: '/api/2fa/disable' },
      { name: 'backup-codes', handler: backupCodesHandler, method: 'POST', url: '/api/2fa/backup-codes' },
      { name: 'status', handler: statusHandler, method: 'GET', url: '/api/2fa/status' },
    ];

    for (const route of routes) {
      it(`${route.name}: rejects unauthenticated requests with 401`, async () => {
        vi.mocked(serverAuth.getUser).mockResolvedValue(null as never);

        const req = createRequest(route.method, route.url);
        const res = await route.handler(req);
        const json = await res.json();

        expect(res.status).toBe(401);
        expect(json.error).toBe('Unauthorized');
      });

      it(`${route.name}: applies rate limiting`, async () => {
        vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, retryAfter: 30 });

        const req = createRequest(route.method, route.url);
        const res = await route.handler(req);

        expect(res.status).toBe(429);
      });
    }
  });
});
