'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJobAware } from '@/lib/api/job-aware-fetch';
import type { RFEAssessmentResult } from '@/lib/ai/rfe/types';

async function fetchRFEAssessment(caseId: string): Promise<RFEAssessmentResult> {
  return fetchJobAware<RFEAssessmentResult>(`/api/cases/${caseId}/rfe-assessment`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * React Query hook for RFE risk assessment.
 */
export function useRFEAssessment(
  caseId: string | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const { enabled = true, staleTime = 30 * 60 * 1000 } = options || {};

  return useQuery<RFEAssessmentResult, Error>({
    queryKey: ['rfe-assessment', caseId],
    queryFn: () => fetchRFEAssessment(caseId!),
    enabled: enabled && !!caseId,
    staleTime,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to invalidate RFE assessment cache.
 */
export function useInvalidateRFEAssessment() {
  const queryClient = useQueryClient();

  return {
    invalidateCase: (caseId: string) => {
      queryClient.invalidateQueries({ queryKey: ['rfe-assessment', caseId] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['rfe-assessment'] });
    },
  };
}

/**
 * Get risk level display info (colors, labels).
 */
export function getRFERiskInfo(riskLevel: string): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (riskLevel) {
    case 'low':
      return { label: 'Low RFE Risk', color: 'text-success', bgColor: 'bg-success/10' };
    case 'medium':
      return { label: 'Medium RFE Risk', color: 'text-warning', bgColor: 'bg-warning/10' };
    case 'high':
      return { label: 'High RFE Risk', color: 'text-orange-600', bgColor: 'bg-orange-600/10' };
    case 'critical':
      return { label: 'Critical RFE Risk', color: 'text-destructive', bgColor: 'bg-destructive/10' };
    default:
      return { label: 'Unknown', color: 'text-muted-foreground', bgColor: 'bg-muted' };
  }
}
