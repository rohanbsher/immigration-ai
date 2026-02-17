'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeadlineAlert } from '@/lib/deadline';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse } from '@/lib/api/parse-response';

/**
 * Response from the deadlines API.
 */
interface DeadlinesResponse {
  deadlines: DeadlineAlert[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    acknowledged: number;
  };
  grouped: {
    critical: DeadlineAlert[];
    warning: DeadlineAlert[];
    info: DeadlineAlert[];
    acknowledged: DeadlineAlert[];
  };
}

/**
 * Fetch deadlines for the current user.
 */
async function fetchDeadlines(days: number = 60): Promise<DeadlinesResponse> {
  const response = await fetchWithTimeout(`/api/cases/deadlines?days=${days}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return parseApiResponse<DeadlinesResponse>(response);
}

/**
 * Update a deadline alert (acknowledge or snooze).
 */
async function updateAlert(
  alertId: string,
  action: 'acknowledge' | 'snooze',
  snoozeDays?: number
): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(`/api/cases/deadlines/${alertId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, snoozeDays }),
  });
  return parseApiResponse<{ success: boolean }>(response);
}

/**
 * React Query hook for deadlines.
 *
 * @param options - Optional configuration
 * @returns Query result with deadlines data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useDeadlines();
 *
 * if (isLoading) return <AILoading />;
 *
 * return (
 *   <DeadlineWidget deadlines={data.deadlines} />
 * );
 * ```
 */
export function useDeadlines(options?: {
  days?: number;
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const { days = 60, enabled = true, refetchInterval } = options || {};

  return useQuery<DeadlinesResponse, Error>({
    queryKey: ['deadlines', days],
    queryFn: () => fetchDeadlines(days),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval,
  });
}

/**
 * Hook for updating deadline alerts.
 */
export function useUpdateDeadlineAlert() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      alertId,
      action,
      snoozeDays,
    }: {
      alertId: string;
      action: 'acknowledge' | 'snooze';
      snoozeDays?: number;
    }) => updateAlert(alertId, action, snoozeDays),
    onSuccess: () => {
      // Invalidate deadlines cache
      queryClient.invalidateQueries({
        queryKey: ['deadlines'],
      });
    },
  });

  return {
    acknowledgeAlert: (alertId: string) =>
      mutation.mutate({ alertId, action: 'acknowledge' }),
    snoozeAlert: (alertId: string, snoozeDays: number = 1) =>
      mutation.mutate({ alertId, action: 'snooze', snoozeDays }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to get deadline counts for badges/indicators.
 */
export function useDeadlineCounts() {
  const { data, isLoading } = useDeadlines({ enabled: true });

  return {
    isLoading,
    total: data?.summary.total || 0,
    critical: data?.summary.critical || 0,
    warning: data?.summary.warning || 0,
    hasUrgent: (data?.summary.critical || 0) > 0,
  };
}

/**
 * Get severity color configuration.
 */
export function getSeverityColors(severity: DeadlineAlert['severity']): {
  bg: string;
  text: string;
  border: string;
  dot: string;
  icon: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
        icon: 'text-red-500',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
        icon: 'text-yellow-500',
      };
    case 'info':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        icon: 'text-blue-500',
      };
  }
}

/**
 * Format days remaining for display.
 */
export function formatDaysRemaining(days: number): string {
  if (days < 0) {
    const absDays = Math.abs(days);
    return `${absDays} ${absDays === 1 ? 'day' : 'days'} overdue`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `${days} days`;
  if (days <= 30) {
    const weeks = Math.ceil(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  const months = Math.ceil(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/**
 * Get alert type label.
 */
export function getAlertTypeLabel(alertType: DeadlineAlert['alertType']): string {
  switch (alertType) {
    case 'case_deadline':
      return 'Case Deadline';
    case 'document_expiry':
      return 'Document Expiring';
    case 'processing_estimate':
      return 'Processing Update';
  }
}
