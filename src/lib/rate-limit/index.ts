/**
 * Rate limiting utility for API endpoints.
 *
 * Uses Upstash Redis in production for distributed rate limiting.
 * Falls back to in-memory storage in development when Redis is not configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Custom key generator function */
  keyGenerator?: (req: NextRequest, userId?: string) => string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// Check if Upstash Redis is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Initialize Redis client if configured
let redis: Redis | null = null;
if (isUpstashConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// In-memory fallback store for development
interface InMemoryEntry {
  timestamps: number[];
  lastCleanup: number;
}
const inMemoryStore = new Map<string, InMemoryEntry>();

// Clean up old in-memory entries periodically
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupInterval: NodeJS.Timeout | null = null;

function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore.entries()) {
    if (now - entry.lastCleanup > 60 * 60 * 1000) {
      inMemoryStore.delete(key);
    }
  }
}

function ensureCleanupRunning(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }
}

/**
 * Default key generator - uses IP address or user ID.
 */
function defaultKeyGenerator(
  req: NextRequest,
  userId?: string,
  keyPrefix?: string
): string {
  const identifier = userId || getClientIp(req) || 'anonymous';
  return keyPrefix ? `${keyPrefix}:${identifier}` : identifier;
}

/**
 * Get client IP address from request headers.
 */
function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return null;
}

/**
 * Check rate limit using in-memory store (development fallback).
 */
function checkRateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanupRunning();

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = inMemoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [], lastCleanup: now };
    inMemoryStore.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
  entry.lastCleanup = now;

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = Math.min(...entry.timestamps);
    const resetAt = new Date(oldestTimestamp + config.windowMs);
    const retryAfterMs = resetAt.getTime() - now;

    return {
      success: false,
      remaining: 0,
      resetAt,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  entry.timestamps.push(now);

  return {
    success: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetAt: new Date(now + config.windowMs),
  };
}

// Cache for Upstash Ratelimit instances
const ratelimitCache = new Map<string, Ratelimit>();

/**
 * Get or create an Upstash Ratelimit instance for the given config.
 */
function getUpstashRatelimiter(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.keyPrefix || 'default'}:${config.maxRequests}:${config.windowMs}`;

  let limiter = ratelimitCache.get(cacheKey);
  if (!limiter && redis) {
    // Convert milliseconds to the appropriate duration string
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
      prefix: config.keyPrefix ? `ratelimit:${config.keyPrefix}` : 'ratelimit',
      analytics: true,
    });
    ratelimitCache.set(cacheKey, limiter);
  }

  return limiter!;
}

/**
 * Check rate limit using Upstash Redis.
 */
async function checkRateLimitUpstash(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const limiter = getUpstashRatelimiter(config);
  const result = await limiter.limit(key);

  const now = Date.now();
  const resetAt = new Date(result.reset);

  return {
    success: result.success,
    remaining: result.remaining,
    resetAt,
    retryAfterMs: result.success ? undefined : Math.max(0, result.reset - now),
  };
}

/**
 * Pre-configured rate limits for different endpoint types.
 */
export const RATE_LIMITS = {
  /** AI endpoints: 10 requests per hour */
  AI: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ai',
  },
  /** Standard API endpoints: 100 requests per minute */
  STANDARD: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'standard',
  },
  /** Auth endpoints: 5 requests per minute */
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'auth',
  },
  /** Sensitive data endpoints: 20 requests per minute */
  SENSITIVE: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'sensitive',
  },
} as const;

/**
 * Create a rate limiter with the specified configuration.
 * Uses Upstash Redis when configured, falls back to in-memory for development.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const useRedis = isUpstashConfigured && redis !== null;

  if (!useRedis && process.env.NODE_ENV === 'production') {
    console.warn(
      '[Rate Limit] Upstash Redis not configured. Using in-memory rate limiting. ' +
      'This will not work correctly with multiple server instances. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.'
    );
  }

  return {
    /**
     * Check if a request is allowed under rate limits.
     */
    async check(req: NextRequest, userId?: string): Promise<RateLimitResult> {
      const key = config.keyGenerator
        ? config.keyGenerator(req, userId)
        : defaultKeyGenerator(req, userId, config.keyPrefix);

      if (useRedis) {
        return checkRateLimitUpstash(key, config);
      }
      return checkRateLimitInMemory(key, config);
    },

    /**
     * Create rate limit response headers.
     */
    getHeaders(result: RateLimitResult): Record<string, string> {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
      };

      if (!result.success && result.retryAfterMs) {
        headers['Retry-After'] = Math.ceil(result.retryAfterMs / 1000).toString();
      }

      return headers;
    },

    /**
     * Apply rate limiting to a request and return appropriate response if limited.
     */
    async limit(
      req: NextRequest,
      userId?: string
    ): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
      const result = await this.check(req, userId);
      const headers = this.getHeaders(result);

      if (!result.success) {
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: 'Too Many Requests',
              message: `Rate limit exceeded. Please try again in ${Math.ceil(
                (result.retryAfterMs || 0) / 1000
              )} seconds.`,
              retryAfter: result.retryAfterMs,
            },
            {
              status: 429,
              headers,
            }
          ),
        };
      }

      return { allowed: true };
    },
  };
}

/**
 * Pre-configured rate limiter for AI endpoints.
 * Limit: 10 requests per hour per user.
 */
export const aiRateLimiter = createRateLimiter(RATE_LIMITS.AI);

/**
 * Pre-configured rate limiter for standard endpoints.
 */
export const standardRateLimiter = createRateLimiter(RATE_LIMITS.STANDARD);

/**
 * Pre-configured rate limiter for auth endpoints.
 */
export const authRateLimiter = createRateLimiter(RATE_LIMITS.AUTH);

/**
 * Pre-configured rate limiter for sensitive data endpoints.
 */
export const sensitiveRateLimiter = createRateLimiter(RATE_LIMITS.SENSITIVE);

/**
 * Higher-order function to wrap an API handler with rate limiting.
 */
export function withRateLimit<T extends NextRequest>(
  handler: (req: T, ...args: unknown[]) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.STANDARD,
  getUserId?: (req: T) => string | undefined
) {
  const limiter = createRateLimiter(config);

  return async (req: T, ...args: unknown[]): Promise<NextResponse> => {
    const userId = getUserId ? getUserId(req) : undefined;
    const limitResult = await limiter.limit(req, userId);

    if (!limitResult.allowed) {
      return limitResult.response;
    }

    const response = await handler(req, ...args);

    // Add rate limit headers to successful responses
    const checkResult = await limiter.check(req, userId);
    const headers = limiter.getHeaders(checkResult);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

/**
 * Reset rate limit for a specific key (useful for testing).
 * Only works with in-memory store.
 */
export function resetRateLimit(key: string): void {
  inMemoryStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing).
 * Only works with in-memory store.
 */
export function clearAllRateLimits(): void {
  inMemoryStore.clear();
}

/**
 * Check if Redis-based rate limiting is active.
 */
export function isRedisRateLimitingEnabled(): boolean {
  return isUpstashConfigured && redis !== null;
}
