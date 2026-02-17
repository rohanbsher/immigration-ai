'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse } from '@/lib/api/parse-response';
import type { ActivityType } from '@/types';

export interface ActivityWithUser {
  id: string;
  case_id: string;
  user_id: string;
  activity_type: ActivityType;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

async function fetchActivities(caseId: string): Promise<ActivityWithUser[]> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/activities`);
  return parseApiResponse<ActivityWithUser[]>(response);
}

export function useActivities(caseId: string) {
  return useQuery({
    queryKey: ['activities', caseId],
    queryFn: () => fetchActivities(caseId),
    enabled: !!caseId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
