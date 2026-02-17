'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

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
  return parseApiResponse<ExportJob[]>(response);
}

async function requestExport(): Promise<{ jobId: string; exportData: unknown }> {
  const response = await fetchWithTimeout('/api/gdpr/export', {
    method: 'POST',
  });
  return parseApiResponse<{ jobId: string; exportData: unknown }>(response);
}

async function fetchDeletionRequest(): Promise<DeletionRequest | null> {
  const response = await fetchWithTimeout('/api/gdpr/delete');
  return parseApiResponse<DeletionRequest | null>(response);
}

async function requestDeletion(reason?: string): Promise<{ id: string; scheduledFor: string }> {
  const response = await fetchWithTimeout('/api/gdpr/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return parseApiResponse<{ id: string; scheduledFor: string }>(response);
}

async function cancelDeletion(reason?: string): Promise<void> {
  const response = await fetchWithTimeout('/api/gdpr/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await parseApiVoidResponse(response);
}

export function useExportJobs() {
  return useQuery({
    queryKey: ['gdpr', 'exports'],
    queryFn: fetchExportJobs,
    staleTime: 5 * 60 * 1000, // 5 minutes — rarely changes
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
    staleTime: 5 * 60 * 1000, // 5 minutes — rarely changes
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
