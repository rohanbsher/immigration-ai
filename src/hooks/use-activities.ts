'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
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
  if (!response.ok) {
    throw new Error('Failed to fetch activities');
  }
  const result = await response.json();
  return result.data;
}

export function useActivities(caseId: string) {
  return useQuery({
    queryKey: ['activities', caseId],
    queryFn: () => fetchActivities(caseId),
    enabled: !!caseId,
  });
}
