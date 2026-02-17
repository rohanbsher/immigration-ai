'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Firm, FirmRole, CreateFirmInput, UpdateFirmInput } from '@/types/firms';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

interface FirmWithRole extends Firm {
  userRole: FirmRole;
}

async function fetchFirms(): Promise<Firm[]> {
  const response = await fetchWithTimeout('/api/firms');
  return parseApiResponse<Firm[]>(response);
}

async function fetchFirm(firmId: string): Promise<FirmWithRole> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}`);
  return parseApiResponse<FirmWithRole>(response);
}

async function createFirm(input: CreateFirmInput): Promise<Firm> {
  const response = await fetchWithTimeout('/api/firms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseApiResponse<Firm>(response);
}

async function updateFirm({
  firmId,
  input,
}: {
  firmId: string;
  input: UpdateFirmInput;
}): Promise<Firm> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseApiResponse<Firm>(response);
}

async function deleteFirm(firmId: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/firms/${firmId}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

export function useFirms() {
  return useQuery({
    queryKey: ['firms'],
    queryFn: fetchFirms,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFirm(firmId: string | undefined) {
  return useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => fetchFirm(firmId!),
    enabled: !!firmId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateFirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFirm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firms'] });
    },
  });
}

export function useUpdateFirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFirm,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['firms'] });
      queryClient.invalidateQueries({ queryKey: ['firm', data.id] });
    },
  });
}

export function useDeleteFirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFirm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firms'] });
    },
  });
}

export function useCurrentFirm() {
  const { data: firms, isLoading } = useFirms();

  if (isLoading || !firms || firms.length === 0) {
    return { firm: null, isLoading };
  }

  return { firm: firms[0], isLoading: false };
}
