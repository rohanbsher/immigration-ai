/**
 * BullMQ Redis connection configuration.
 *
 * BullMQ requires a standard Redis connection (ioredis), NOT the Upstash REST API.
 *
 * Two separate Redis instances are used:
 *   - Railway Redis: REDIS_URL (BullMQ job queues, noeviction policy)
 *     Worker uses private URL (redis://...railway.internal:6379)
 *     Vercel uses public URL (redis://...<host>.railway.app:<port>)
 *   - Upstash Redis: UPSTASH_REDIS_REST_URL (rate limiting, HTTP REST)
 *
 * This separation is required because:
 *   - BullMQ needs noeviction (jobs must never be evicted)
 *   - Rate limiting needs volatile-ttl (expired keys should auto-evict)
 *   - Vercel Edge Functions need HTTP REST (can't use TCP sockets)
 *   - Railway private networking gives sub-ms latency to the worker
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
    enableReadyCheck: false,
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
      'Set REDIS_URL to your Railway Redis endpoint.'
    );
  }
  return connection;
}
