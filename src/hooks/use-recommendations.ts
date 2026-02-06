'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CachedRecommendations, Recommendation } from '@/lib/db/recommendations';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { safeParseErrorJson } from '@/lib/api/safe-json';

/**
 * Fetch recommendations for a case.
 */
async function fetchRecommendations(
  caseId: string,
  forceRefresh = false
): Promise<CachedRecommendations> {
  const url = forceRefresh
    ? `/api/cases/${caseId}/recommendations?refresh=true`
    : `/api/cases/${caseId}/recommendations`;

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.message || 'Failed to fetch recommendations');
  }

  return response.json();
}

/**
 * Update a recommendation (complete or dismiss).
 */
async function updateRecommendation(
  caseId: string,
  recommendationId: string,
  action: 'complete' | 'dismiss'
): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/recommendations`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recommendationId, action }),
  });

  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.message || 'Failed to update recommendation');
  }

  return response.json();
}

/**
 * React Query hook for case recommendations.
 *
 * @param caseId - The case ID to fetch recommendations for
 * @param options - Optional configuration
 * @returns Query result with recommendations data
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useRecommendations(caseId);
 *
 * if (isLoading) return <AILoading />;
 *
 * return (
 *   <NextStepsPanel recommendations={data.recommendations} />
 * );
 * ```
 */
export function useRecommendations(
  caseId: string | undefined,
  options?: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    staleTime?: number;
  }
) {
  const { enabled = true, refetchOnMount = false, staleTime = 30 * 60 * 1000 } = options || {};

  const query = useQuery<CachedRecommendations, Error>({
    queryKey: ['recommendations', caseId],
    queryFn: () => fetchRecommendations(caseId!),
    enabled: enabled && !!caseId,
    staleTime, // Consider data fresh for 30 minutes
    refetchOnMount,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    refetch: async () => {
      return query.refetch();
    },
    forceRefresh: async () => {
      const result = await fetchRecommendations(caseId!, true);
      return result;
    },
  };
}

/**
 * Hook for updating recommendations (complete/dismiss).
 */
export function useUpdateRecommendation(caseId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      recommendationId,
      action,
    }: {
      recommendationId: string;
      action: 'complete' | 'dismiss';
    }) => updateRecommendation(caseId, recommendationId, action),
    onSuccess: () => {
      // Invalidate recommendations cache
      queryClient.invalidateQueries({
        queryKey: ['recommendations', caseId],
      });
    },
  });

  return {
    completeRecommendation: (recommendationId: string) =>
      mutation.mutate({ recommendationId, action: 'complete' }),
    dismissRecommendation: (recommendationId: string) =>
      mutation.mutate({ recommendationId, action: 'dismiss' }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to invalidate recommendations cache.
 */
export function useInvalidateRecommendations() {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalidate recommendations for a specific case.
     */
    invalidateCase: (caseId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['recommendations', caseId],
      });
    },

    /**
     * Invalidate all recommendations queries.
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({
        queryKey: ['recommendations'],
      });
    },
  };
}

/**
 * Get priority color configuration.
 */
export function getPriorityColors(priority: Recommendation['priority']): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (priority) {
    case 'high':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
      };
    case 'low':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
  }
}

/**
 * Get category icon name.
 */
export function getCategoryIcon(category: Recommendation['category']): string {
  switch (category) {
    case 'document':
      return 'FileText';
    case 'form':
      return 'ClipboardList';
    case 'deadline':
      return 'Clock';
    case 'review':
      return 'Eye';
    default:
      return 'Lightbulb';
  }
}

/**
 * Format priority label.
 */
export function getPriorityLabel(priority: Recommendation['priority']): string {
  switch (priority) {
    case 'high':
      return 'High Priority';
    case 'medium':
      return 'Medium Priority';
    case 'low':
      return 'Low Priority';
  }
}
