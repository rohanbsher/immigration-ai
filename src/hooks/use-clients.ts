'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClientWithCases, Client, UpdateClientData } from '@/lib/db/clients';

// Fetch all clients
async function fetchClients(): Promise<ClientWithCases[]> {
  const response = await fetch('/api/clients');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch clients');
  }
  return response.json();
}

// Fetch single client
async function fetchClient(id: string): Promise<ClientWithCases> {
  const response = await fetch(`/api/clients/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch client');
  }
  return response.json();
}

// Fetch client cases
async function fetchClientCases(clientId: string) {
  const response = await fetch(`/api/clients/${clientId}/cases`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch client cases');
  }
  return response.json();
}

// Update client
async function updateClient({
  id,
  data,
}: {
  id: string;
  data: UpdateClientData;
}): Promise<Client> {
  const response = await fetch(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update client');
  }
  return response.json();
}

// Search clients
async function searchClients(query: string): Promise<Client[]> {
  const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search clients');
  }
  return response.json();
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => fetchClient(id),
    enabled: !!id,
  });
}

export function useClientCases(clientId: string) {
  return useQuery({
    queryKey: ['clients', clientId, 'cases'],
    queryFn: () => fetchClientCases(clientId),
    enabled: !!clientId,
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

export function useSearchClients(query: string) {
  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: () => searchClients(query),
    enabled: query.length >= 2,
  });
}
