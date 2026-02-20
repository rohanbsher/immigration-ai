/**
 * Recommendations Caching Layer
 *
 * Provides caching for AI-generated recommendations using Redis.
 * Falls back to direct API calls when cache misses.
 */

import { createLogger } from '@/lib/logger';
import { getRedisClient } from '@/lib/rate-limit/redis';

const logger = createLogger('db:recommendations');

/**
 * Recommendation item structure.
 */
export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  category: 'document' | 'form' | 'deadline' | 'review' | 'other';
  actionUrl?: string;
  completed?: boolean;
  dismissedAt?: string;
}

/**
 * Cached recommendations structure.
 */
export interface CachedRecommendations {
  caseId: string;
  recommendations: Recommendation[];
  generatedAt: string;
  expiresAt: string;
  source: 'ai' | 'cache' | 'fallback';
}

// Cache key prefix
const CACHE_PREFIX = 'recommendations';

// Cache TTL: 1 hour
const CACHE_TTL_SECONDS = 60 * 60;

// Use the shared Redis client singleton
const redis = getRedisClient();

/**
 * Get cache key for a case.
 */
function getCacheKey(caseId: string): string {
  return `${CACHE_PREFIX}:${caseId}`;
}

/**
 * Get cached recommendations for a case.
 *
 * @param caseId - The case ID
 * @returns Cached recommendations or null if not found/expired
 */
export async function getCachedRecommendations(
  caseId: string
): Promise<CachedRecommendations | null> {
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get<CachedRecommendations>(getCacheKey(caseId));

    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date(cached.expiresAt) < new Date()) {
      await redis.del(getCacheKey(caseId));
      return null;
    }

    return { ...cached, source: 'cache' };
  } catch (error) {
    logger.logError('Error fetching cached recommendations', error, { caseId });
    return null;
  }
}

/**
 * Cache recommendations for a case.
 *
 * @param caseId - The case ID
 * @param recommendations - The recommendations to cache
 */
export async function cacheRecommendations(
  caseId: string,
  recommendations: Recommendation[]
): Promise<void> {
  if (!redis) {
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

  const cached: CachedRecommendations = {
    caseId,
    recommendations,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: 'ai',
  };

  try {
    await redis.setex(getCacheKey(caseId), CACHE_TTL_SECONDS, cached);
  } catch (error) {
    logger.logError('Error caching recommendations', error, { caseId });
  }
}

/**
 * Invalidate cached recommendations for a case.
 *
 * @param caseId - The case ID
 */
export async function invalidateCachedRecommendations(
  caseId: string
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    await redis.del(getCacheKey(caseId));
  } catch (error) {
    logger.logError('Error invalidating cached recommendations', error, { caseId });
  }
}

/**
 * Mark a recommendation as completed.
 *
 * @param caseId - The case ID
 * @param recommendationId - The recommendation ID to mark complete
 */
export async function markRecommendationComplete(
  caseId: string,
  recommendationId: string
): Promise<boolean> {
  if (!redis) {
    return false;
  }

  try {
    const cached = await getCachedRecommendations(caseId);
    if (!cached) {
      return false;
    }

    const updatedRecommendations = cached.recommendations.map((rec) => {
      if (rec.id === recommendationId) {
        return { ...rec, completed: true };
      }
      return rec;
    });

    await cacheRecommendations(caseId, updatedRecommendations);
    return true;
  } catch (error) {
    logger.logError('Error marking recommendation complete', error, { caseId, recommendationId });
    return false;
  }
}

/**
 * Dismiss a recommendation.
 *
 * @param caseId - The case ID
 * @param recommendationId - The recommendation ID to dismiss
 */
export async function dismissRecommendation(
  caseId: string,
  recommendationId: string
): Promise<boolean> {
  if (!redis) {
    return false;
  }

  try {
    const cached = await getCachedRecommendations(caseId);
    if (!cached) {
      return false;
    }

    const updatedRecommendations = cached.recommendations.map((rec) => {
      if (rec.id === recommendationId) {
        return { ...rec, dismissedAt: new Date().toISOString() };
      }
      return rec;
    });

    await cacheRecommendations(caseId, updatedRecommendations);
    return true;
  } catch (error) {
    logger.logError('Error dismissing recommendation', error, { caseId, recommendationId });
    return false;
  }
}

/**
 * Get active (not completed or dismissed) recommendations.
 */
export function filterActiveRecommendations(
  recommendations: Recommendation[]
): Recommendation[] {
  return recommendations.filter(
    (rec) => !rec.completed && !rec.dismissedAt
  );
}

/**
 * Sort recommendations by priority.
 */
export function sortRecommendationsByPriority(
  recommendations: Recommendation[]
): Recommendation[] {
  const priorityOrder: Record<Recommendation['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

/**
 * Get recommendations for a case.
 * Fetches from cache or generates new recommendations.
 *
 * @param caseId - The case ID
 * @param userId - The user ID (for authorization)
 * @returns Recommendations result
 */
export async function getRecommendations(
  caseId: string,
  _userId: string
): Promise<CachedRecommendations> {
  // Try to get cached recommendations first
  const cached = await getCachedRecommendations(caseId);
  if (cached) {
    return {
      ...cached,
      recommendations: sortRecommendationsByPriority(
        filterActiveRecommendations(cached.recommendations)
      ),
      source: 'cache',
    };
  }

  // Return empty result - actual generation should be done via API
  return {
    caseId,
    recommendations: [],
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    source: 'cache',
  };
}
