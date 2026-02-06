'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentType, DocumentStatus } from '@/types';
import {
  fetchWithTimeout,
  uploadWithTimeout,
  fetchAI,
  TimeoutError,
} from '@/lib/api/fetch-with-timeout';
import { safeParseErrorJson } from '@/lib/api/safe-json';

interface Document {
  id: string;
  case_id: string;
  uploaded_by: string;
  document_type: DocumentType;
  status: DocumentStatus;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  ai_extracted_data: Record<string, unknown> | null;
  ai_confidence_score: number | null;
  verified_by: string | null;
  verified_at: string | null;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  uploader: {
    id: string;
    first_name: string;
    last_name: string;
  };
  verifier?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface UploadDocumentData {
  case_id: string;
  document_type: DocumentType;
  file: File;
  expiration_date?: string;
  notes?: string;
}

interface UpdateDocumentData {
  document_type?: DocumentType;
  status?: DocumentStatus;
  expiration_date?: string | null;
  notes?: string | null;
}

async function fetchDocuments(caseId: string): Promise<Document[]> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/documents`);
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  return response.json();
}

async function fetchDocument(id: string): Promise<Document> {
  const response = await fetchWithTimeout(`/api/documents/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }
  return response.json();
}

async function uploadDocument(data: UploadDocumentData): Promise<Document> {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('document_type', data.document_type);
  if (data.expiration_date) formData.append('expiration_date', data.expiration_date);
  if (data.notes) formData.append('notes', data.notes);

  const response = await uploadWithTimeout(
    `/api/cases/${data.case_id}/documents`,
    formData
  );

  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to upload document');
  }
  return response.json();
}

async function updateDocument(id: string, data: UpdateDocumentData): Promise<Document> {
  const response = await fetchWithTimeout(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to update document');
  }
  return response.json();
}

async function verifyDocument(id: string): Promise<Document> {
  const response = await fetchWithTimeout(`/api/documents/${id}/verify`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to verify document');
  }
  return response.json();
}

async function analyzeDocument(id: string): Promise<Document> {
  // Document analysis uses AI, so use longer timeout
  const response = await fetchAI(`/api/documents/${id}/analyze`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to analyze document');
  }
  return response.json();
}

async function deleteDocument(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await safeParseErrorJson(response);
    throw new Error(error.error || 'Failed to delete document');
  }
}

export function useDocuments(caseId: string | undefined) {
  return useQuery({
    queryKey: ['documents', caseId],
    queryFn: () => fetchDocuments(caseId!),
    enabled: !!caseId,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id!),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: (_, { case_id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', case_id] });
      queryClient.invalidateQueries({ queryKey: ['case', case_id] });
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentData }) =>
      updateDocument(id, data),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents', document.case_id] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
    },
  });
}

export function useVerifyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyDocument,
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents', document.case_id] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
    },
  });
}

export function useAnalyzeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: analyzeDocument,
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents', document.case_id] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; caseId: string }) => deleteDocument(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['billing-usage'] });
    },
  });
}

export function useDocumentChecklist(visaType: string | undefined) {
  return useQuery({
    queryKey: ['documentChecklist', visaType],
    queryFn: async () => {
      const response = await fetchWithTimeout(`/api/document-checklists/${visaType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document checklist');
      }
      return response.json();
    },
    enabled: !!visaType,
  });
}

// Re-export TimeoutError for consumers who need to handle it
export { TimeoutError };
