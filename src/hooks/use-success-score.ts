'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SuccessScore } from '@/lib/ai/success-probability';
import { fetchJobAware } from '@/lib/api/job-aware-fetch';

/**
 * Fetch success probability score for a case.
 */
async function fetchSuccessScore(caseId: string): Promise<SuccessScore> {
  // May return 202 (async job) when worker is enabled
  return fetchJobAware<SuccessScore>(`/api/cases/${caseId}/success-score`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
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
      bg: 'bg-success/10',
      text: 'text-success',
      border: 'border-success',
      gradient: 'from-success to-success/70',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-info/10',
      text: 'text-info',
      border: 'border-info',
      gradient: 'from-info to-info/70',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-warning/10',
      text: 'text-warning',
      border: 'border-warning',
      gradient: 'from-warning to-warning/70',
    };
  }
  return {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive',
    gradient: 'from-destructive to-destructive/70',
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
      return { icon: 'check', color: 'text-success', bgColor: 'bg-success/10' };
    case 'warning':
      return { icon: 'alert', color: 'text-warning', bgColor: 'bg-warning/10' };
    case 'poor':
      return { icon: 'x', color: 'text-destructive', bgColor: 'bg-destructive/10' };
  }
}
