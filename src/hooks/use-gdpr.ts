'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { safeParseErrorJson } from '@/lib/api/safe-json';

interface ExportJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

interface DeletionRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'cancelled';
  reason: string | null;
  scheduled_for: string;
  created_at: string;
}

async function fetchExportJobs(): Promise<ExportJob[]> {
  const response = await fetchWithTimeout('/api/gdpr/export');
  if (!response.ok) {
    throw new Error('Failed to fetch export history');
  }
  const result = await response.json();
  return result.data;
}

async function requestExport(): Promise<{ jobId: string; exportData: unknown }> {
  const response = await fetchWithTimeout('/api/gdpr/export', {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to request export');
  }
  const result = await response.json();
  return result.data;
}

async function fetchDeletionRequest(): Promise<DeletionRequest | null> {
  const response = await fetchWithTimeout('/api/gdpr/delete');
  if (!response.ok) {
    throw new Error('Failed to fetch deletion status');
  }
  const result = await response.json();
  return result.data;
}

async function requestDeletion(reason?: string): Promise<{ id: string; scheduledFor: string }> {
  const response = await fetchWithTimeout('/api/gdpr/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to request deletion');
  }
  const result = await response.json();
  return result.data;
}

async function cancelDeletion(reason?: string): Promise<void> {
  const response = await fetchWithTimeout('/api/gdpr/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to cancel deletion');
  }
}

export function useExportJobs() {
  return useQuery({
    queryKey: ['gdpr', 'exports'],
    queryFn: fetchExportJobs,
  });
}

export function useRequestExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestExport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr', 'exports'] });
    },
  });
}

export function useDeletionRequest() {
  return useQuery({
    queryKey: ['gdpr', 'deletion'],
    queryFn: fetchDeletionRequest,
  });
}

export function useRequestDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestDeletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr', 'deletion'] });
    },
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelDeletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr', 'deletion'] });
    },
  });
}
