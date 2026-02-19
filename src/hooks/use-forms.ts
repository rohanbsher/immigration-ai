'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormType, FormStatus } from '@/types';
import { fetchWithTimeout, TimeoutError } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';
import { fetchJobAware } from '@/lib/api/job-aware-fetch';

interface Form {
  id: string;
  case_id: string;
  form_type: FormType;
  status: FormStatus;
  form_data: Record<string, unknown>;
  ai_filled_data: Record<string, unknown> | null;
  ai_confidence_scores: Record<string, number> | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  filed_at: string | null;
  created_at: string;
  updated_at: string;
  reviewer?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface CreateFormData {
  case_id: string;
  form_type: FormType;
  form_data?: Record<string, unknown>;
}

interface UpdateFormData {
  status?: FormStatus;
  form_data?: Record<string, unknown>;
  review_notes?: string | null;
}

async function fetchForms(caseId: string): Promise<Form[]> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/forms`);
  return parseApiResponse<Form[]>(response);
}

async function fetchForm(id: string): Promise<Form> {
  const response = await fetchWithTimeout(`/api/forms/${id}`);
  return parseApiResponse<Form>(response);
}

async function createForm(data: CreateFormData): Promise<Form> {
  const response = await fetchWithTimeout(`/api/cases/${data.case_id}/forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Form>(response);
}

async function updateForm(id: string, data: UpdateFormData): Promise<Form> {
  const response = await fetchWithTimeout(`/api/forms/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<Form>(response);
}

async function autofillForm(id: string): Promise<Form> {
  // Form autofill may return 202 (async job) when worker is enabled
  return fetchJobAware<Form>(`/api/forms/${id}/autofill`, {
    method: 'POST',
    timeout: 'AI',
  });
}

async function reviewForm(id: string, notes: string): Promise<Form> {
  const response = await fetchWithTimeout(`/api/forms/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  return parseApiResponse<Form>(response);
}

async function fileForm(id: string): Promise<Form> {
  const response = await fetchWithTimeout(`/api/forms/${id}/file`, {
    method: 'POST',
  });
  return parseApiResponse<Form>(response);
}

async function deleteForm(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/forms/${id}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

export function useForms(caseId: string | undefined) {
  return useQuery({
    queryKey: ['forms', caseId],
    queryFn: () => fetchForms(caseId!),
    enabled: !!caseId,
    staleTime: 30 * 1000, // 30 seconds — active editing context
  });
}

export function useForm(id: string | undefined) {
  return useQuery({
    queryKey: ['form', id],
    queryFn: () => fetchForm(id!),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds — active editing context
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createForm,
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: ['forms', case_id] });
      queryClient.invalidateQueries({ queryKey: ['case', case_id] });
    },
  });
}

export function useUpdateForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFormData }) =>
      updateForm(id, data),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms', form.case_id] });
      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
    },
  });
}

export function useAutofillForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: autofillForm,
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms', form.case_id] });
      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
    },
  });
}

export function useReviewForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      reviewForm(id, notes),
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms', form.case_id] });
      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
    },
  });
}

export function useFileForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fileForm,
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ['forms', form.case_id] });
      queryClient.invalidateQueries({ queryKey: ['form', form.id] });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; caseId: string }) => deleteForm(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forms', variables.caseId] });
    },
  });
}

// Re-export TimeoutError for consumers who need to handle it
export { TimeoutError };
