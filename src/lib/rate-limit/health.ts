/**
 * Redis health monitoring utilities.
 * Provides detailed metrics and health status for rate limiting infrastructure.
 */

import { getRedisClient } from './redis';
import { features } from '@/lib/config';

export interface RedisHealthMetrics {
  connected: boolean;
  latency: number | null;
  error: string | null;
  provider: 'upstash' | 'in-memory' | 'none';
  lastChecked: string;
}

export interface RateLimitMetrics {
  totalKeys: number | null;
  memoryUsage: string | null;
  provider: 'upstash' | 'in-memory';
  configured: boolean;
}

export interface DetailedRedisHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: RedisHealthMetrics;
  rateLimitInfo: RateLimitMetrics;
  recommendations: string[];
}

// Check if Upstash Redis is configured via feature flag
const isUpstashConfigured = features.redisRateLimiting;

/**
 * Ping Redis and measure latency.
 */
async function pingRedis(): Promise<{ success: boolean; latency: number; error?: string }> {
  const client = getRedisClient();
  if (!client) {
    return { success: false, latency: 0, error: 'Redis not configured' };
  }

  const start = Date.now();
  try {
    await client.ping();
    return { success: true, latency: Date.now() - start };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get rate limit key count (approximate).
 */
async function getRateLimitKeyCount(): Promise<number | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    // Get keys matching rate limit prefix
    const keys = await client.keys('ratelimit:*');
    return keys.length;
  } catch {
    return null;
  }
}

/**
 * Get detailed Redis health information.
 */
export async function getDetailedRedisHealth(): Promise<DetailedRedisHealth> {
  const recommendations: string[] = [];
  const isProduction = features.isProduction;

  // Check Redis connectivity
  const pingResult = await pingRedis();

  const metrics: RedisHealthMetrics = {
    connected: pingResult.success,
    latency: pingResult.success ? pingResult.latency : null,
    error: pingResult.error || null,
    provider: isUpstashConfigured ? 'upstash' : 'in-memory',
    lastChecked: new Date().toISOString(),
  };

  // Get rate limit info
  const keyCount = await getRateLimitKeyCount();
  const rateLimitInfo: RateLimitMetrics = {
    totalKeys: keyCount,
    memoryUsage: null, // Upstash doesn't expose memory usage directly
    provider: isUpstashConfigured ? 'upstash' : 'in-memory',
    configured: isUpstashConfigured,
  };

  // Determine status and generate recommendations
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!isUpstashConfigured) {
    if (isProduction) {
      status = 'unhealthy';
      recommendations.push(
        'CRITICAL: Redis is not configured for production. Rate limiting will fail-closed.',
        'Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
      );
    } else {
      status = 'degraded';
      recommendations.push(
        'Using in-memory rate limiting (development only).',
        'Configure Redis for production deployments.'
      );
    }
  } else if (!pingResult.success) {
    status = 'unhealthy';
    recommendations.push(
      `Redis connection failed: ${pingResult.error}`,
      'Check Upstash Redis credentials and network connectivity.'
    );
  } else if (pingResult.latency > 500) {
    status = 'degraded';
    recommendations.push(
      `Redis latency is high (${pingResult.latency}ms). Consider checking Upstash region settings.`
    );
  }

  // Additional recommendations based on key count
  if (keyCount !== null && keyCount > 10000) {
    recommendations.push(
      `High number of rate limit keys (${keyCount}). Consider reviewing rate limit policies.`
    );
  }

  return {
    status,
    metrics,
    rateLimitInfo,
    recommendations,
  };
}

/**
 * Quick health check for Redis - returns simple pass/fail.
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  message: string;
  latency?: number;
}> {
  if (!isUpstashConfigured) {
    return {
      healthy: !features.isProduction,
      message: features.isProduction
        ? 'Redis not configured (CRITICAL in production)'
        : 'Using in-memory fallback (development)',
    };
  }

  const pingResult = await pingRedis();
  if (!pingResult.success) {
    return {
      healthy: false,
      message: `Redis connection failed: ${pingResult.error}`,
    };
  }

  return {
    healthy: true,
    message: 'Redis connected',
    latency: pingResult.latency,
  };
}

/**
 * Check if Redis-based rate limiting is active and healthy.
 */
export function isRedisConfigured(): boolean {
  return isUpstashConfigured;
}

/**
 * Get Redis configuration status (for health endpoints).
 */
export function getRedisConfigStatus(): {
  configured: boolean;
  provider: 'upstash' | 'in-memory' | 'none';
  environmentComplete: boolean;
} {
  return {
    configured: isUpstashConfigured,
    provider: isUpstashConfigured ? 'upstash' : 'in-memory',
    environmentComplete: isUpstashConfigured,
  };
}
