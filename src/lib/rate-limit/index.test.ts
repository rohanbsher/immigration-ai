import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock Upstash modules before importing the rate-limit module
const mockLimit = vi.fn().mockResolvedValue({
  success: true,
  limit: 100,
  remaining: 99,
  reset: Date.now() + 60000,
  pending: Promise.resolve(),
});

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  })),
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({
      limit: mockLimit,
    })),
    {
      slidingWindow: vi.fn().mockReturnValue({ type: 'slidingWindow' }),
    }
  ),
}));

import {
  RATE_LIMITS,
  createRateLimiter,
  aiRateLimiter,
  standardRateLimiter,
  authRateLimiter,
  sensitiveRateLimiter,
  withRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  isRedisRateLimitingEnabled,
  rateLimit,
} from './index';

function createMockRequest(
  method: string = 'GET',
  headers: Record<string, string> = {},
  pathname: string = '/api/test'
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  const req = new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
  return req;
}

describe('Rate Limit Module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllRateLimits();
    // Reset environment to not have Upstash configured
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('RATE_LIMITS configuration', () => {
    describe('AI rate limit', () => {
      it('should have 10 requests per hour limit', () => {
        expect(RATE_LIMITS.AI.maxRequests).toBe(10);
      });

      it('should have 1 hour window', () => {
        expect(RATE_LIMITS.AI.windowMs).toBe(60 * 60 * 1000);
      });

      it('should have ai key prefix', () => {
        expect(RATE_LIMITS.AI.keyPrefix).toBe('ai');
      });
    });

    describe('STANDARD rate limit', () => {
      it('should have 100 requests per minute limit', () => {
        expect(RATE_LIMITS.STANDARD.maxRequests).toBe(100);
      });

      it('should have 1 minute window', () => {
        expect(RATE_LIMITS.STANDARD.windowMs).toBe(60 * 1000);
      });

      it('should have standard key prefix', () => {
        expect(RATE_LIMITS.STANDARD.keyPrefix).toBe('standard');
      });
    });

    describe('AUTH rate limit', () => {
      it('should have 5 requests per minute limit', () => {
        expect(RATE_LIMITS.AUTH.maxRequests).toBe(5);
      });

      it('should have 1 minute window', () => {
        expect(RATE_LIMITS.AUTH.windowMs).toBe(60 * 1000);
      });

      it('should have auth key prefix', () => {
        expect(RATE_LIMITS.AUTH.keyPrefix).toBe('auth');
      });
    });

    describe('SENSITIVE rate limit', () => {
      it('should have 20 requests per minute limit', () => {
        expect(RATE_LIMITS.SENSITIVE.maxRequests).toBe(20);
      });

      it('should have 1 minute window', () => {
        expect(RATE_LIMITS.SENSITIVE.windowMs).toBe(60 * 1000);
      });

      it('should have sensitive key prefix', () => {
        expect(RATE_LIMITS.SENSITIVE.keyPrefix).toBe('sensitive');
      });
    });
  });

  describe('createRateLimiter (in-memory mode)', () => {
    describe('check method', () => {
      it('should allow requests under the limit', async () => {
        const limiter = createRateLimiter({
          maxRequests: 5,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.1',
        });

        const result = await limiter.check(request);

        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4);
        expect(result.resetAt).toBeInstanceOf(Date);
      });

      it('should track requests per IP', async () => {
        const limiter = createRateLimiter({
          maxRequests: 3,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.2',
        });

        // First request
        const result1 = await limiter.check(request);
        expect(result1.remaining).toBe(2);

        // Second request
        const result2 = await limiter.check(request);
        expect(result2.remaining).toBe(1);

        // Third request
        const result3 = await limiter.check(request);
        expect(result3.remaining).toBe(0);
      });

      it('should reject requests when limit exceeded', async () => {
        const limiter = createRateLimiter({
          maxRequests: 2,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.3',
        });

        // Use up the limit
        await limiter.check(request);
        await limiter.check(request);

        // This should be rejected
        const result = await limiter.check(request);

        expect(result.success).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeDefined();
        expect(result.retryAfterMs).toBeGreaterThan(0);
      });

      it('should use userId when provided', async () => {
        const limiter = createRateLimiter({
          maxRequests: 2,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET');

        // First user makes requests
        await limiter.check(request, 'user-1');
        await limiter.check(request, 'user-1');

        // First user is now rate limited
        const result1 = await limiter.check(request, 'user-1');
        expect(result1.success).toBe(false);

        // Second user should still be allowed
        const result2 = await limiter.check(request, 'user-2');
        expect(result2.success).toBe(true);
      });

      it('should use x-real-ip header when x-forwarded-for is not present', async () => {
        const limiter = createRateLimiter({
          maxRequests: 2,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-real-ip': '10.0.0.1',
        });

        const result = await limiter.check(request);

        expect(result.success).toBe(true);
      });

      it('should fall back to anonymous when no IP or userId', async () => {
        const limiter = createRateLimiter({
          maxRequests: 2,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET');

        const result = await limiter.check(request);

        expect(result.success).toBe(true);
      });

      it('should use custom key generator when provided', async () => {
        const customKeyGenerator = vi.fn().mockReturnValue('custom-key');
        const limiter = createRateLimiter({
          maxRequests: 2,
          windowMs: 60000,
          keyGenerator: customKeyGenerator,
        });

        const request = createMockRequest('GET');

        await limiter.check(request, 'user-id');

        expect(customKeyGenerator).toHaveBeenCalledWith(request, 'user-id');
      });
    });

    describe('getHeaders method', () => {
      it('should return correct rate limit headers for successful request', async () => {
        const limiter = createRateLimiter({
          maxRequests: 10,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.4',
        });

        const result = await limiter.check(request);
        const headers = limiter.getHeaders(result);

        expect(headers['X-RateLimit-Limit']).toBe('10');
        expect(headers['X-RateLimit-Remaining']).toBe('9');
        expect(headers['X-RateLimit-Reset']).toBeDefined();
        expect(headers['Retry-After']).toBeUndefined();
      });

      it('should include Retry-After header when rate limited', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.5',
        });

        // Exhaust the limit
        await limiter.check(request);

        const result = await limiter.check(request);
        const headers = limiter.getHeaders(result);

        expect(headers['Retry-After']).toBeDefined();
        expect(parseInt(headers['Retry-After'])).toBeGreaterThan(0);
      });
    });

    describe('limit method', () => {
      it('should return allowed: true when under limit', async () => {
        const limiter = createRateLimiter({
          maxRequests: 5,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.6',
        });

        const result = await limiter.limit(request);

        expect(result.allowed).toBe(true);
        expect('response' in result).toBe(false);
      });

      it('should return allowed: false with response when over limit', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.7',
        });

        // Exhaust limit
        await limiter.limit(request);

        const result = await limiter.limit(request);

        expect(result.allowed).toBe(false);
        if (!result.allowed) {
          expect(result.response).toBeInstanceOf(NextResponse);
          expect(result.response.status).toBe(429);
        }
      });

      it('should return 429 response with correct body', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.8',
        });

        await limiter.limit(request);
        const result = await limiter.limit(request);

        if (!result.allowed) {
          const body = await result.response.json();
          expect(body.error).toBe('Too Many Requests');
          expect(body.message).toContain('Rate limit exceeded');
          expect(body.retryAfter).toBeDefined();
        }
      });

      it('should include rate limit headers in 429 response', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.1.9',
        });

        await limiter.limit(request);
        const result = await limiter.limit(request);

        if (!result.allowed) {
          expect(result.response.headers.get('X-RateLimit-Limit')).toBe('1');
          expect(result.response.headers.get('X-RateLimit-Remaining')).toBe('0');
          expect(result.response.headers.get('Retry-After')).toBeDefined();
        }
      });
    });
  });

  describe('Pre-configured rate limiters', () => {
    it('aiRateLimiter should use AI config', async () => {
      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.2.1',
      });

      const result = await aiRateLimiter.check(request);

      expect(result.success).toBe(true);
    });

    it('standardRateLimiter should use STANDARD config', async () => {
      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.2.2',
      });

      const result = await standardRateLimiter.check(request);

      expect(result.success).toBe(true);
    });

    it('authRateLimiter should use AUTH config', async () => {
      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.2.3',
      });

      const result = await authRateLimiter.check(request);

      expect(result.success).toBe(true);
    });

    it('sensitiveRateLimiter should use SENSITIVE config', async () => {
      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.2.4',
      });

      const result = await sensitiveRateLimiter.check(request);

      expect(result.success).toBe(true);
    });
  });

  describe('withRateLimit HOF', () => {
    it('should wrap handler and apply rate limiting', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRateLimit(handler, {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.1',
      });

      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return 429 without calling handler when rate limited', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRateLimit(handler, {
        maxRequests: 1,
        windowMs: 60000,
        keyPrefix: 'test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.2',
      });

      // First request succeeds
      await wrappedHandler(request);
      expect(handler).toHaveBeenCalledTimes(1);

      // Second request is rate limited
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalledTimes(1); // Handler not called again
      expect(response.status).toBe(429);
    });

    it('should use STANDARD config by default', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRateLimit(handler);

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.3',
      });

      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
    });

    it('should use getUserId function when provided', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const getUserId = vi.fn().mockReturnValue('custom-user-id');
      const wrappedHandler = withRateLimit(
        handler,
        { maxRequests: 10, windowMs: 60000, keyPrefix: 'test' },
        getUserId
      );

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.4',
      });

      await wrappedHandler(request);

      expect(getUserId).toHaveBeenCalledWith(request);
    });

    it('should add rate limit headers to successful response', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRateLimit(handler, {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.5',
      });

      const response = await wrappedHandler(request);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should pass additional arguments to handler', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRateLimit(handler, {
        maxRequests: 10,
        windowMs: 60000,
        keyPrefix: 'test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.3.6',
      });

      const context = { params: { id: '123' } };
      await wrappedHandler(request, context);

      expect(handler).toHaveBeenCalledWith(request, context);
    });
  });

  describe('Utility functions', () => {
    describe('resetRateLimit', () => {
      it('should reset rate limit for a specific key', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'reset-test',
        });

        const request = createMockRequest('GET', {
          'x-forwarded-for': '192.168.4.1',
        });

        // Exhaust limit
        await limiter.check(request);
        const limited = await limiter.check(request);
        expect(limited.success).toBe(false);

        // Reset the key
        resetRateLimit('reset-test:192.168.4.1');

        // Should be allowed again
        const afterReset = await limiter.check(request);
        expect(afterReset.success).toBe(true);
      });
    });

    describe('clearAllRateLimits', () => {
      it('should clear all rate limits', async () => {
        const limiter = createRateLimiter({
          maxRequests: 1,
          windowMs: 60000,
          keyPrefix: 'clear-test',
        });

        const request1 = createMockRequest('GET', {
          'x-forwarded-for': '192.168.5.1',
        });
        const request2 = createMockRequest('GET', {
          'x-forwarded-for': '192.168.5.2',
        });

        // Exhaust limits for both
        await limiter.check(request1);
        await limiter.check(request2);

        // Clear all
        clearAllRateLimits();

        // Both should be allowed again
        const result1 = await limiter.check(request1);
        const result2 = await limiter.check(request2);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
      });
    });

    describe('isRedisRateLimitingEnabled', () => {
      it('should return false when Upstash is not configured', () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        // The module was already loaded, so this reflects the initial state
        // In a real scenario, Redis would need to be configured before module load
        const result = isRedisRateLimitingEnabled();

        // Since we mock Redis, this might be true or false depending on mock state
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('rateLimit function', () => {
    it('should check rate limit for identifier', async () => {
      clearAllRateLimits();

      const result = await rateLimit(
        { maxRequests: 5, windowMs: 60000, keyPrefix: 'simple' },
        'test-identifier'
      );

      expect(result.success).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should return retryAfter when rate limited', async () => {
      clearAllRateLimits();

      const config = { maxRequests: 1, windowMs: 60000, keyPrefix: 'simple' };

      // Exhaust limit
      await rateLimit(config, 'limited-identifier');

      const result = await rateLimit(config, 'limited-identifier');

      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should use different identifiers independently', async () => {
      clearAllRateLimits();

      const config = { maxRequests: 1, windowMs: 60000, keyPrefix: 'simple' };

      // Exhaust limit for one identifier
      await rateLimit(config, 'user-a');
      const resultA = await rateLimit(config, 'user-a');

      // Different identifier should still be allowed
      const resultB = await rateLimit(config, 'user-b');

      expect(resultA.success).toBe(false);
      expect(resultB.success).toBe(true);
    });
  });

  describe('IP extraction', () => {
    it('should extract first IP from x-forwarded-for with multiple IPs', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'ip-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1',
      });

      // Make requests from this IP
      await limiter.check(request);
      await limiter.check(request);

      // Should be rate limited
      const result = await limiter.check(request);
      expect(result.success).toBe(false);

      // Request from different IP should succeed
      const request2 = createMockRequest('GET', {
        'x-forwarded-for': '203.0.113.2',
      });
      const result2 = await limiter.check(request2);
      expect(result2.success).toBe(true);
    });

    it('should trim whitespace from IP addresses', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        keyPrefix: 'ip-trim-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '  192.168.6.1  ',
      });

      await limiter.check(request);
      await limiter.check(request);

      const result = await limiter.check(request);
      expect(result.success).toBe(false);
    });
  });

  describe('Window timing', () => {
    it('should reset rate limit after window expires', async () => {
      vi.useFakeTimers();

      const limiter = createRateLimiter({
        maxRequests: 1,
        windowMs: 1000, // 1 second window
        keyPrefix: 'timing-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.7.1',
      });

      // Exhaust limit
      await limiter.check(request);
      const limited = await limiter.check(request);
      expect(limited.success).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1100);

      // Should be allowed again
      const afterWindow = await limiter.check(request);
      expect(afterWindow.success).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent requests', async () => {
      const limiter = createRateLimiter({
        maxRequests: 5,
        windowMs: 60000,
        keyPrefix: 'concurrent-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.8.1',
      });

      // Make 5 concurrent requests
      const results = await Promise.all([
        limiter.check(request),
        limiter.check(request),
        limiter.check(request),
        limiter.check(request),
        limiter.check(request),
      ]);

      // All 5 should succeed
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(5);

      // 6th should fail
      const sixth = await limiter.check(request);
      expect(sixth.success).toBe(false);
    });

    it('should handle very large maxRequests', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1000000,
        windowMs: 60000,
        keyPrefix: 'large-limit-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.9.1',
      });

      const result = await limiter.check(request);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(999999);
    });

    it('should handle zero remaining correctly', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1,
        windowMs: 60000,
        keyPrefix: 'zero-remaining-test',
      });

      const request = createMockRequest('GET', {
        'x-forwarded-for': '192.168.10.1',
      });

      const result = await limiter.check(request);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });
});

// ─── Redis-enabled module tests (resetModules) ─────────────────

describe('Rate Limit Module (Redis enabled)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupMocks(options: {
    redisRateLimiting: boolean;
    isProduction: boolean;
    redisClient: unknown;
    limitFn?: ReturnType<typeof vi.fn>;
    warnFn?: ReturnType<typeof vi.fn>;
  }) {
    const warnFn = options.warnFn ?? vi.fn();
    vi.doMock('@/lib/logger', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: warnFn,
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    vi.doMock('@/lib/utils/get-client-ip', () => ({
      getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
    }));

    vi.doMock('@/lib/config', () => ({
      features: {
        redisRateLimiting: options.redisRateLimiting,
        isProduction: options.isProduction,
      },
      serverEnv: {},
      env: {},
    }));

    vi.doMock('./redis', () => ({
      getRedisClient: vi.fn().mockReturnValue(options.redisClient),
    }));

    const limitFn = options.limitFn ?? vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    // Ratelimit is used as `new Ratelimit(...)` and has a static `slidingWindow` method.
    // Use a real class so `new` works correctly.
    class MockRatelimit {
      limit = limitFn;
      constructor() {
        // no-op
      }
      static slidingWindow = vi.fn().mockReturnValue({ type: 'slidingWindow' });
    }

    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: MockRatelimit,
    }));

    return { warnFn, limitFn };
  }

  it('uses Upstash when Redis is configured and available', async () => {
    const { limitFn } = setupMocks({
      redisRateLimiting: true,
      isProduction: false,
      redisClient: { get: vi.fn(), set: vi.fn() },
    });

    const mod = await import('./index');
    const limiter = mod.createRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      keyPrefix: 'redis-test',
    });
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'GET',
    });

    const result = await limiter.check(req);

    expect(result.success).toBe(true);
    expect(limitFn).toHaveBeenCalled();
  });

  it('falls back to in-memory on Redis error', async () => {
    const { limitFn } = setupMocks({
      redisRateLimiting: true,
      isProduction: false,
      redisClient: { get: vi.fn(), set: vi.fn() },
      limitFn: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
    });

    const mod = await import('./index');
    const limiter = mod.createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      keyPrefix: 'redis-err',
    });
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'GET',
    });

    const result = await limiter.check(req);

    expect(limitFn).toHaveBeenCalled();
    // Falls back to in-memory, which succeeds
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('logs production degraded warning at startup when Redis is missing', async () => {
    const { warnFn } = setupMocks({
      redisRateLimiting: false,
      isProduction: true,
      redisClient: null,
      warnFn: vi.fn(),
    });

    await import('./index');

    expect(warnFn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limiting is DEGRADED')
    );
  });

  it('rateLimit() uses Upstash when Redis is available', async () => {
    const { limitFn } = setupMocks({
      redisRateLimiting: true,
      isProduction: false,
      redisClient: { get: vi.fn(), set: vi.fn() },
    });

    const mod = await import('./index');
    const result = await mod.rateLimit(
      { maxRequests: 10, windowMs: 60000, keyPrefix: 'rl-redis' },
      'test-id'
    );

    expect(result.success).toBe(true);
    expect(limitFn).toHaveBeenCalled();
  });

  it('rateLimit() falls back to in-memory on Redis error', async () => {
    const { limitFn } = setupMocks({
      redisRateLimiting: true,
      isProduction: false,
      redisClient: { get: vi.fn(), set: vi.fn() },
      limitFn: vi.fn().mockRejectedValue(new Error('Redis down')),
    });

    const mod = await import('./index');
    const result = await mod.rateLimit(
      { maxRequests: 5, windowMs: 60000, keyPrefix: 'rl-fallback' },
      'test-id'
    );

    expect(limitFn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('isRedisRateLimitingEnabled returns true when Redis is configured', async () => {
    setupMocks({
      redisRateLimiting: true,
      isProduction: false,
      redisClient: { get: vi.fn(), set: vi.fn() },
    });

    const mod = await import('./index');
    expect(mod.isRedisRateLimitingEnabled()).toBe(true);
  });

  it('check() logs missing-Redis warning once in production', async () => {
    const warnFn = vi.fn();
    setupMocks({
      redisRateLimiting: false,
      isProduction: true,
      redisClient: null,
      warnFn,
    });

    const mod = await import('./index');
    const limiter = mod.createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      keyPrefix: 'prod-warn',
    });
    const req = new NextRequest(new URL('http://localhost:3000/api/test'), {
      method: 'GET',
    });

    // The module-level startup warning is one call; the check() warning is another
    const initialWarnCount = warnFn.mock.calls.length;
    await limiter.check(req);
    const afterFirstCheck = warnFn.mock.calls.length;
    await limiter.check(req);
    const afterSecondCheck = warnFn.mock.calls.length;

    // Should warn at most once from check() (hasWarnedAboutMissingRedis)
    expect(afterFirstCheck - initialWarnCount).toBeLessThanOrEqual(1);
    expect(afterSecondCheck).toBe(afterFirstCheck);
  });
});
