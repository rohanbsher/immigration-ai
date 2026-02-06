'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompletenessResult } from '@/lib/ai/document-completeness';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { safeParseErrorJson } from '@/lib/api/safe-json';

/**
 * Fetch document completeness analysis for a case.
 */
async function fetchCompleteness(caseId: string): Promise<CompletenessResult> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/completeness`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.message || 'Failed to fetch completeness');
  }

  return response.json();
}

/**
 * React Query hook for document completeness analysis.
 *
 * @param caseId - The case ID to analyze
 * @param options - Optional configuration
 * @returns Query result with completeness data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDocumentCompleteness(caseId);
 *
 * if (isLoading) return <AILoading />;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     <p>Completeness: {data.overallCompleteness}%</p>
 *   </div>
 * );
 * ```
 */
export function useDocumentCompleteness(
  caseId: string | undefined,
  options?: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    staleTime?: number;
  }
) {
  const { enabled = true, refetchOnMount = true, staleTime = 5 * 60 * 1000 } = options || {};

  return useQuery<CompletenessResult, Error>({
    queryKey: ['document-completeness', caseId],
    queryFn: () => fetchCompleteness(caseId!),
    enabled: enabled && !!caseId,
    staleTime, // Consider data fresh for 5 minutes
    refetchOnMount,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to invalidate completeness cache.
 * Call this after document upload/deletion.
 */
export function useInvalidateCompleteness() {
  const queryClient = useQueryClient();

  return {
    /**
     * Invalidate completeness for a specific case.
     */
    invalidateCase: (caseId: string) => {
      queryClient.invalidateQueries({
        queryKey: ['document-completeness', caseId],
      });
    },

    /**
     * Invalidate all completeness queries.
     */
    invalidateAll: () => {
      queryClient.invalidateQueries({
        queryKey: ['document-completeness'],
      });
    },
  };
}

/**
 * Get completeness color based on percentage.
 */
export function getCompletenessColor(completeness: number): {
  bg: string;
  text: string;
  ring: string;
} {
  if (completeness >= 100) {
    return { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-500' };
  }
  if (completeness >= 70) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-500' };
  }
  if (completeness >= 40) {
    return { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-500' };
  }
  return { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500' };
}

/**
 * Get filing readiness label and color.
 */
export function getFilingReadinessInfo(readiness: CompletenessResult['filingReadiness']): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (readiness) {
    case 'ready':
      return { label: 'Ready to File', color: 'text-green-700', bgColor: 'bg-green-100' };
    case 'needs_review':
      return { label: 'Needs Review', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 'incomplete':
    default:
      return { label: 'Incomplete', color: 'text-red-700', bgColor: 'bg-red-100' };
  }
}
