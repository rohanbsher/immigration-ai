import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type QuotaMetric = 'cases' | 'documents' | 'ai_requests' | 'storage' | 'team_members';

export interface QuotaCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  message?: string;
}

async function fetchQuota(metric: QuotaMetric): Promise<QuotaCheck> {
  const response = await fetch(`/api/billing/quota?metric=${metric}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to check quota');
  }

  return data.data;
}

export function useQuota(metric: QuotaMetric) {
  return useQuery({
    queryKey: ['quota', metric],
    queryFn: () => fetchQuota(metric),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useQuotaCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metric: QuotaMetric) => {
      const response = await fetch(`/api/billing/quota?metric=${metric}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check quota');
      }

      return data.data as QuotaCheck;
    },
    onSuccess: (data, metric) => {
      queryClient.setQueryData(['quota', metric], data);
    },
  });
}

export function useInvalidateQuotas() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['quota'] });
  };
}
