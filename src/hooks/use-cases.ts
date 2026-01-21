'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CaseStatus, VisaType } from '@/types';

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
  if (pagination.page) params.set('page', pagination.page.toString());
  if (pagination.limit) params.set('limit', pagination.limit.toString());
  if (pagination.sortBy) params.set('sortBy', pagination.sortBy);
  if (pagination.sortOrder) params.set('sortOrder', pagination.sortOrder);

  const response = await fetch(`/api/cases?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch cases');
  }
  return response.json();
}

async function fetchCase(id: string): Promise<Case> {
  const response = await fetch(`/api/cases/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch case');
  }
  return response.json();
}

async function createCase(data: CreateCaseData): Promise<Case> {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create case');
  }
  return response.json();
}

async function updateCase(id: string, data: UpdateCaseData): Promise<Case> {
  const response = await fetch(`/api/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update case');
  }
  return response.json();
}

async function deleteCase(id: string): Promise<void> {
  const response = await fetch(`/api/cases/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete case');
  }
}

export function useCases(
  filters: CaseFilters = {},
  pagination: PaginationOptions = {}
) {
  return useQuery({
    queryKey: ['cases', filters, pagination],
    queryFn: () => fetchCases(filters, pagination),
  });
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: ['case', id],
    queryFn: () => fetchCase(id!),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
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
    },
  });
}

export function useCaseStats() {
  return useQuery({
    queryKey: ['caseStats'],
    queryFn: async () => {
      const response = await fetch('/api/cases/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch case stats');
      }
      return response.json();
    },
  });
}
