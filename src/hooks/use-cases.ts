'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CaseStatus, VisaType } from '@/types';
import { fetchWithTimeout, TimeoutError } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';

interface Case {
  id: string;
  attorney_id: string;
  client_id: string;
  visa_type: VisaType;
  status: CaseStatus;
  title: string;
  description: string | null;
  priority_date: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  attorney: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  documents_count: number;
  forms_count: number;
}

interface CaseFilters {
  status?: CaseStatus | CaseStatus[];
  visa_type?: VisaType | VisaType[];
  search?: string;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateCaseData {
  client_id: string;
  visa_type: VisaType;
  title: string;
  description?: string;
  priority_date?: string;
  deadline?: string;
  notes?: string;
}

interface UpdateCaseData {
  visa_type?: VisaType;
  status?: CaseStatus;
  title?: string;
  description?: string | null;
  priority_date?: string | null;
  deadline?: string | null;
  notes?: string | null;
}

interface CaseStats {
  total: number;
  pendingDeadlines: number;
  byStatus: Record<string, number>;
}

async function fetchCases(
  filters: CaseFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ cases: Case[]; total: number }> {
  const params = new URLSearchParams();

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach(s => params.append('status', s));
    } else {
      params.set('status', filters.status);
    }
  }

  if (filters.visa_type) {
    if (Array.isArray(filters.visa_type)) {
      filters.visa_type.forEach(v => params.append('visa_type', v));
    } else {
      params.set('visa_type', filters.visa_type);
    }
  }

  if (filters.search) params.set('search', filters.search);
  if (pagination.page != null) params.set('page', pagination.page.toString());
  if (pagination.limit != null) params.set('limit', pagination.limit.toString());
  if (pagination.sortBy) params.set('sortBy', pagination.sortBy);
  if (pagination.sortOrder) params.set('sortOrder', pagination.sortOrder);

  const response = await fetchWithTimeout(`/api/cases?${params.toString()}`);
  return parseApiResponse<{ cases: Case[]; total: number }>(response);
}

async function fetchCase(id: string): Promise<Case> {
  const response = await fetchWithTimeout(`/api/cases/${id}`);
  return parseApiResponse<Case>(response);
}

async function createCase(data: CreateCaseData): Promise<Case> {
  const response = await fetchWithTimeout('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Case>(response);
}

async function updateCase(id: string, data: UpdateCaseData): Promise<Case> {
  const response = await fetchWithTimeout(`/api/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Case>(response);
}

async function deleteCase(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/cases/${id}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

export function useCases(
  filters: CaseFilters = {},
  pagination: PaginationOptions = {}
) {
  return useQuery({
    queryKey: ['cases', filters, pagination],
    queryFn: () => fetchCases(filters, pagination),
    staleTime: 30 * 1000, // 30 seconds — may update from other tabs
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['case', id],
    queryFn: () => fetchCase(id!),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds — may update during active work
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
    },
  });
}

export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCaseData }) =>
      updateCase(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['case', id] });
    },
  });
}

export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
    },
  });
}

export function useCaseStats() {
  return useQuery({
    queryKey: ['caseStats'],
    queryFn: async () => {
      const response = await fetchWithTimeout('/api/cases/stats', {
        timeout: 'QUICK',
      });
      return parseApiResponse<CaseStats>(response);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes — aggregated data, changes slowly
  });
}

// Re-export TimeoutError for consumers who need to handle it
export { TimeoutError };
