/**
 * Shared Redis client singleton.
 *
 * Provides a single Redis instance for the entire application,
 * avoiding duplicate connections across rate limiting, caching, and
 * health monitoring modules.
 *
 * Uses Upstash Redis (HTTP-based, serverless-friendly).
 *
 * @example
 * ```typescript
 * import { getRedisClient, isRedisAvailable } from '@/lib/rate-limit/redis';
 *
 * if (isRedisAvailable()) {
 *   const redis = getRedisClient()!;
 *   await redis.set('key', 'value');
 * }
 * ```
 */

import { Redis } from '@upstash/redis';
import { serverEnv, features } from '@/lib/config';

let redisInstance: Redis | null = null;

/**
 * Get the shared Redis client instance.
 *
 * Returns `null` when Upstash Redis is not configured
 * (missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN).
 *
 * The client is lazily created on first call and reused thereafter.
 */
export function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;

  if (!features.redisRateLimiting) return null;

  const url = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redisInstance = new Redis({ url, token });
  return redisInstance;
}

/**
 * Check whether Redis is configured and available.
 */
export function isRedisAvailable(): boolean {
  return getRedisClient() !== null;
}
