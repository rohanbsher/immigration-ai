'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompletenessResult } from '@/lib/ai/document-completeness';
import { fetchJobAware } from '@/lib/api/job-aware-fetch';

/**
 * Fetch document completeness analysis for a case.
 */
async function fetchCompleteness(caseId: string): Promise<CompletenessResult> {
  // May return 202 (async job) when worker is enabled
  return fetchJobAware<CompletenessResult>(`/api/cases/${caseId}/completeness`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
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
    return { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success' };
  }
  if (completeness >= 70) {
    return { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning' };
  }
  if (completeness >= 40) {
    return { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning' };
  }
  return { bg: 'bg-destructive/10', text: 'text-destructive', ring: 'ring-destructive' };
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
      return { label: 'Ready to File', color: 'text-success', bgColor: 'bg-success/10' };
    case 'needs_review':
      return { label: 'Needs Review', color: 'text-warning', bgColor: 'bg-warning/10' };
    case 'incomplete':
    default:
      return { label: 'Incomplete', color: 'text-destructive', bgColor: 'bg-destructive/10' };
  }
}
