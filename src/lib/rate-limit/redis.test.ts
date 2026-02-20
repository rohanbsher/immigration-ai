import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Redis Client Module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns null when redisRateLimiting feature is false', async () => {
    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: false },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'token-123',
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(),
    }));

    const { getRedisClient } = await import('./redis');
    expect(getRedisClient()).toBeNull();
  });

  it('returns null when UPSTASH_REDIS_REST_URL is missing', async () => {
    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: true },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: 'token-123',
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(),
    }));

    const { getRedisClient } = await import('./redis');
    expect(getRedisClient()).toBeNull();
  });

  it('returns null when UPSTASH_REDIS_REST_TOKEN is missing', async () => {
    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: true },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(),
    }));

    const { getRedisClient } = await import('./redis');
    expect(getRedisClient()).toBeNull();
  });

  it('creates Redis instance when all config is present', async () => {
    const mockRedisInstance = { get: vi.fn(), set: vi.fn() };
    let constructorArgs: unknown = null;

    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: true },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'token-123',
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: class MockRedis {
        constructor(opts: unknown) {
          constructorArgs = opts;
          Object.assign(this, mockRedisInstance);
        }
      },
    }));

    const { getRedisClient } = await import('./redis');
    const client = getRedisClient();

    expect(client).not.toBeNull();
    expect(constructorArgs).toEqual({
      url: 'https://redis.example.com',
      token: 'token-123',
    });
  });

  it('returns cached instance on second call (singleton)', async () => {
    let constructCount = 0;

    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: true },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'token-123',
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: class MockRedis {
        constructor() {
          constructCount++;
        }
      },
    }));

    const { getRedisClient } = await import('./redis');

    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(second);
    expect(constructCount).toBe(1);
  });

  it('isRedisAvailable() returns true when client is available', async () => {
    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: true },
      serverEnv: {
        UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
        UPSTASH_REDIS_REST_TOKEN: 'token-123',
      },
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: class MockRedis {
        get = vi.fn();
        set = vi.fn();
      },
    }));

    const { isRedisAvailable } = await import('./redis');
    expect(isRedisAvailable()).toBe(true);
  });

  it('isRedisAvailable() returns false when client is null', async () => {
    vi.doMock('@/lib/config', () => ({
      features: { redisRateLimiting: false },
      serverEnv: {},
    }));

    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn(),
    }));

    const { isRedisAvailable } = await import('./redis');
    expect(isRedisAvailable()).toBe(false);
  });
});
