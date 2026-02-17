'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClientWithCases, Client, CreateClientData, UpdateClientData } from '@/lib/db/clients';
import type { CaseStatus, VisaType } from '@/types';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse } from '@/lib/api/parse-response';

export interface ClientsPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ClientsResponse {
  data: ClientWithCases[];
  pagination: ClientsPaginationMeta;
}

// Fetch all clients (unpaginated - fetches with high limit for backward compatibility)
async function fetchClients(): Promise<ClientWithCases[]> {
  const response = await fetchWithTimeout('/api/clients?limit=100');
  const json = await parseApiResponse<ClientsResponse>(response);
  return json.data;
}

// Fetch clients with pagination
async function fetchClientsPaginated(
  page: number,
  limit: number,
  search?: string
): Promise<ClientsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) {
    params.set('search', search);
  }
  const response = await fetchWithTimeout(`/api/clients?${params.toString()}`);
  return parseApiResponse<ClientsResponse>(response);
}

// Fetch single client
async function fetchClient(id: string): Promise<ClientWithCases> {
  const response = await fetchWithTimeout(`/api/clients/${id}`);
  return parseApiResponse<ClientWithCases>(response);
}

interface ClientCaseItem {
  id: string;
  title: string;
  visa_type: VisaType;
  status: CaseStatus;
  deadline: string | null;
  created_at: string;
  [key: string]: unknown;
}

// Fetch client cases
async function fetchClientCases(clientId: string): Promise<ClientCaseItem[]> {
  const response = await fetchWithTimeout(`/api/clients/${clientId}/cases`);
  return parseApiResponse<ClientCaseItem[]>(response);
}

// Update client
async function updateClient({
  id,
  data,
}: {
  id: string;
  data: UpdateClientData;
}): Promise<Client> {
  const response = await fetchWithTimeout(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Client>(response);
}

// Create client
async function createClient(data: CreateClientData): Promise<Client> {
  const response = await fetchWithTimeout('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Client>(response);
}

// Search clients
async function searchClients(query: string): Promise<Client[]> {
  const response = await fetchWithTimeout(
    `/api/clients/search?q=${encodeURIComponent(query)}`,
    { timeout: 'QUICK' }
  );
  return parseApiResponse<Client[]>(response);
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useClientCases(clientId: string) {
  return useQuery({
    queryKey: ['clients', clientId, 'cases'],
    queryFn: () => fetchClientCases(clientId),
    enabled: !!clientId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateClient,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', variables.id] });
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useSearchClients(query: string) {
  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: () => searchClients(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useClientsPaginated(page: number, limit: number, search?: string) {
  return useQuery({
    queryKey: ['clients', 'paginated', page, limit, search],
    queryFn: () => fetchClientsPaginated(page, limit, search),
    staleTime: 30 * 1000, // 30 seconds
  });
}
