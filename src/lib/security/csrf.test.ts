import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCsrf,
  csrfMiddleware,
  withCsrfProtection,
  generateCsrfToken,
  CSRF_COOKIE_CONFIG,
} from './csrf';

function createMockRequest(
  method: string,
  headers: Record<string, string> = {},
  pathname = '/api/test'
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  const req = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  return req;
}

describe('CSRF Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://immigrationai.app';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateCsrf', () => {
    describe('GET requests (non-state-changing)', () => {
      it('should allow GET requests without origin validation', () => {
        const request = createMockRequest('GET');
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should allow HEAD requests without origin validation', () => {
        const request = createMockRequest('HEAD');
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should allow OPTIONS requests without origin validation', () => {
        const request = createMockRequest('OPTIONS');
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe('POST requests (state-changing)', () => {
      it('should allow POST with valid origin header', () => {
        const request = createMockRequest('POST', {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should allow POST with valid referer header', () => {
        const request = createMockRequest('POST', {
          referer: 'http://localhost:3000/some-page',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should reject POST with invalid origin', () => {
        const request = createMockRequest('POST', {
          origin: 'https://malicious-site.com',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('not allowed');
      });

      it('should reject POST without origin or referer', () => {
        const request = createMockRequest('POST', {
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Missing Origin/Referer');
      });

      it('should reject POST with x-api-client header (bypass removed)', () => {
        const request = createMockRequest('POST', {
          'x-api-client': 'true',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
      });

      it('should allow exact billing webhook path without origin', () => {
        const request = createMockRequest('POST', {}, '/api/billing/webhooks');
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
        expect(result.reason).toBe('webhook');
      });

      it('should reject non-billing webhook paths without origin', () => {
        const request1 = createMockRequest('POST', {}, '/api/webhook/payment');
        const request2 = createMockRequest('POST', {}, '/webhooks/event');
        const request3 = createMockRequest('POST', {}, '/api/webhooks/stripe');

        expect(validateCsrf(request1).valid).toBe(false);
        expect(validateCsrf(request2).valid).toBe(false);
        expect(validateCsrf(request3).valid).toBe(false);
      });
    });

    describe('PUT requests', () => {
      it('should validate PUT requests', () => {
        const request = createMockRequest('PUT', {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should reject PUT with invalid origin', () => {
        const request = createMockRequest('PUT', {
          origin: 'https://attacker.com',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
      });
    });

    describe('PATCH requests', () => {
      it('should validate PATCH requests', () => {
        const request = createMockRequest('PATCH', {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe('DELETE requests', () => {
      it('should validate DELETE requests', () => {
        const request = createMockRequest('DELETE', {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe('Production environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('should use https protocol in production', () => {
        const request = createMockRequest('POST', {
          origin: 'https://immigrationai.app',
          host: 'immigrationai.app',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });

      it('should not allow localhost in production by default', () => {
        const request = createMockRequest('POST', {
          origin: 'http://localhost:3000',
          host: 'immigrationai.app',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(false);
      });
    });

    describe('Vercel environment', () => {
      it('should allow Vercel preview URLs', () => {
        process.env.VERCEL_URL = 'my-app-abc123.vercel.app';

        const request = createMockRequest('POST', {
          origin: 'https://my-app-abc123.vercel.app',
          host: 'my-app-abc123.vercel.app',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });

    describe('X-Forwarded-Proto header', () => {
      it('should respect x-forwarded-proto header', () => {
        const request = createMockRequest('POST', {
          origin: 'https://immigrationai.app',
          host: 'immigrationai.app',
          'x-forwarded-proto': 'https',
        });
        const result = validateCsrf(request);

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('csrfMiddleware', () => {
    it('should return null for valid requests', () => {
      const request = createMockRequest('POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });
      const result = csrfMiddleware(request);

      expect(result).toBeNull();
    });

    it('should return 403 response for invalid requests', () => {
      const request = createMockRequest('POST', {
        origin: 'https://malicious.com',
        host: 'localhost:3000',
      });
      const result = csrfMiddleware(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(403);
    });

    it('should return error JSON body', async () => {
      const request = createMockRequest('POST', {
        origin: 'https://malicious.com',
        host: 'localhost:3000',
      });
      const result = csrfMiddleware(request);
      const body = await result?.json();

      expect(body).toEqual({ error: 'CSRF validation failed' });
    });
  });

  describe('withCsrfProtection', () => {
    it('should call handler for valid requests', async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      const protectedHandler = withCsrfProtection(mockHandler);

      const request = createMockRequest('POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });

      const result = await protectedHandler(request);
      const body = await result.json();

      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(body).toEqual({ success: true });
    });

    it('should return 403 without calling handler for invalid requests', async () => {
      const mockHandler = vi.fn();
      const protectedHandler = withCsrfProtection(mockHandler);

      const request = createMockRequest('POST', {
        origin: 'https://evil.com',
        host: 'localhost:3000',
      });

      const result = await protectedHandler(request);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.status).toBe(403);
    });

    it('should pass additional arguments to handler', async () => {
      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ ok: true }));
      const protectedHandler = withCsrfProtection(mockHandler);

      const request = createMockRequest('POST', {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      });

      const context = { params: { id: '123' } };
      await protectedHandler(request, context);

      expect(mockHandler).toHaveBeenCalledWith(request, context);
    });
  });

  describe('generateCsrfToken', () => {
    it('should generate a unique token', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
    });

    it('should generate token of reasonable length', () => {
      const token = generateCsrfToken();

      expect(token.length).toBeGreaterThan(10);
    });

    it('should generate token with valid format', () => {
      const token = generateCsrfToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('CSRF_COOKIE_CONFIG', () => {
    it('should have correct cookie name', () => {
      expect(CSRF_COOKIE_CONFIG.name).toBe('csrf_token');
    });

    it('should have httpOnly option', () => {
      expect(CSRF_COOKIE_CONFIG.options.httpOnly).toBe(true);
    });

    it('should have strict sameSite', () => {
      expect(CSRF_COOKIE_CONFIG.options.sameSite).toBe('strict');
    });

    it('should have correct path', () => {
      expect(CSRF_COOKIE_CONFIG.options.path).toBe('/');
    });

    it('should have 24 hour maxAge', () => {
      expect(CSRF_COOKIE_CONFIG.options.maxAge).toBe(60 * 60 * 24);
    });

    it('should set secure based on environment', () => {
      expect(typeof CSRF_COOKIE_CONFIG.options.secure).toBe('boolean');
    });
  });
});
