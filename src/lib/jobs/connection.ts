/**
 * BullMQ Redis connection configuration.
 *
 * BullMQ requires a standard Redis connection (ioredis), NOT the Upstash REST API.
 * Upstash provides both:
 *   - REST API: UPSTASH_REDIS_REST_URL (used by @upstash/redis for rate limiting)
 *   - Standard Redis: REDIS_URL (used by BullMQ via ioredis)
 *
 * The REDIS_URL comes from Upstash dashboard > your database > Details tab.
 * Format: rediss://default:<password>@<host>:6379
 */

import { ConnectionOptions } from 'bullmq';

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false, // Upstash compatibility
  };
}

let connectionOptions: ConnectionOptions | null = null;

/**
 * Get BullMQ Redis connection options.
 * Returns null if REDIS_URL is not configured.
 */
export function getJobConnection(): ConnectionOptions | null {
  if (connectionOptions) return connectionOptions;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  connectionOptions = parseRedisUrl(redisUrl);
  return connectionOptions;
}

/**
 * Get BullMQ Redis connection options, throwing if not configured.
 * Use this in contexts where Redis is required (worker service, job submission).
 */
export function requireJobConnection(): ConnectionOptions {
  const connection = getJobConnection();
  if (!connection) {
    throw new Error(
      'REDIS_URL is not configured. BullMQ requires a standard Redis connection. ' +
      'Set REDIS_URL to your Upstash Redis standard endpoint (rediss://...).'
    );
  }
  return connection;
}
