'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormType, FormStatus } from '@/types';

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
  const response = await fetch(`/api/cases/${caseId}/forms`);
  if (!response.ok) {
    throw new Error('Failed to fetch forms');
  }
  return response.json();
}

async function fetchForm(id: string): Promise<Form> {
  const response = await fetch(`/api/forms/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch form');
  }
  return response.json();
}

async function createForm(data: CreateFormData): Promise<Form> {
  const response = await fetch(`/api/cases/${data.case_id}/forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create form');
  }
  return response.json();
}

async function updateForm(id: string, data: UpdateFormData): Promise<Form> {
  const response = await fetch(`/api/forms/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update form');
  }
  return response.json();
}

async function autofillForm(id: string): Promise<Form> {
  const response = await fetch(`/api/forms/${id}/autofill`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to autofill form');
  }
  return response.json();
}

async function reviewForm(id: string, notes: string): Promise<Form> {
  const response = await fetch(`/api/forms/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to review form');
  }
  return response.json();
}

async function fileForm(id: string): Promise<Form> {
  const response = await fetch(`/api/forms/${id}/file`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mark form as filed');
  }
  return response.json();
}

async function deleteForm(id: string): Promise<void> {
  const response = await fetch(`/api/forms/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete form');
  }
}

export function useForms(caseId: string | undefined) {
  return useQuery({
    queryKey: ['forms', caseId],
    queryFn: () => fetchForms(caseId!),
    enabled: !!caseId,
  });
}

export function useForm(id: string | undefined) {
  return useQuery({
    queryKey: ['form', id],
    queryFn: () => fetchForm(id!),
    enabled: !!id,
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
    mutationFn: deleteForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
}
