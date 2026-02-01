'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SuccessScore } from '@/lib/scoring/success-probability';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

/**
 * Fetch success probability score for a case.
 */
async function fetchSuccessScore(caseId: string): Promise<SuccessScore> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/success-score`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch success score');
  }

  return response.json();
}

/**
 * React Query hook for success probability score.
 *
 * @param caseId - The case ID to analyze
 * @param options - Optional configuration
 * @returns Query result with success score data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSuccessScore(caseId);
 *
 * if (isLoading) return <AILoading />;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <SuccessScoreBadge score={data.overallScore} />
 * );
 * ```
 */
export function useSuccessScore(
  caseId: string | undefined,
  options?: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    staleTime?: number;
  }
) {
  const { enabled = true, refetchOnMount = false, staleTime = 60 * 60 * 1000 } = options || {};

  return useQuery<SuccessScore, Error>({
    queryKey: ['success-score', caseId],
    queryFn: () => fetchSuccessScore(caseId!),
    enabled: enabled && !!caseId,
    staleTime, // Consider data fresh for 1 hour
    refetchOnMount,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to invalidate success score cache.
 * Call this after significant case changes.
 */
export function useInvalidateSuccessScore() {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalidate success score for a specific case.
     */
    invalidateCase: (caseId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['success-score', caseId],
      });
    },

    /**
     * Invalidate all success score queries.
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({
        queryKey: ['success-score'],
      });
    },
  };
}

/**
 * Get success score color configuration.
 */
export function getSuccessScoreColors(score: number): {
  bg: string;
  text: string;
  border: string;
  gradient: string;
} {
  if (score >= 80) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-500',
      gradient: 'from-green-500 to-emerald-500',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-500',
      gradient: 'from-blue-500 to-cyan-500',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      border: 'border-yellow-500',
      gradient: 'from-yellow-500 to-orange-500',
    };
  }
  return {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
    gradient: 'from-red-500 to-rose-500',
  };
}

/**
 * Get success score label.
 * Note: Duplicated here to avoid importing server-side code from success-probability.ts
 */
export function getSuccessScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}

/**
 * Get factor status icon info.
 */
export function getFactorStatusInfo(status: 'good' | 'warning' | 'poor'): {
  icon: 'check' | 'alert' | 'x';
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'good':
      return { icon: 'check', color: 'text-green-600', bgColor: 'bg-green-100' };
    case 'warning':
      return { icon: 'alert', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    case 'poor':
      return { icon: 'x', color: 'text-red-600', bgColor: 'bg-red-100' };
  }
}
