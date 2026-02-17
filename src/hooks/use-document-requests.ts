'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { parseApiResponse, parseApiVoidResponse } from '@/lib/api/parse-response';
import type { DocumentType } from '@/types';

export type DocumentRequestStatus = 'pending' | 'uploaded' | 'fulfilled' | 'expired' | 'cancelled';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface DocumentRequest {
  id: string;
  case_id: string;
  requested_by: string;
  document_type: DocumentType;
  status: DocumentRequestStatus;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: RequestPriority;
  fulfilled_by_document_id: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  fulfilled_document?: {
    id: string;
    file_name: string;
    file_url: string;
  };
}

interface CreateDocumentRequestData {
  document_type: DocumentType;
  title: string;
  description?: string;
  due_date?: string;
  priority?: RequestPriority;
}

interface UpdateDocumentRequestData {
  status?: DocumentRequestStatus;
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: RequestPriority;
  fulfilled_by_document_id?: string | null;
}

async function fetchDocumentRequests(
  caseId: string,
  pendingOnly = false
): Promise<{ data: DocumentRequest[] }> {
  const params = new URLSearchParams();
  if (pendingOnly) params.set('pending', 'true');

  const response = await fetchWithTimeout(
    `/api/cases/${caseId}/document-requests?${params.toString()}`
  );
  return parseApiResponse<{ data: DocumentRequest[] }>(response);
}

async function createDocumentRequest(
  caseId: string,
  data: CreateDocumentRequestData
): Promise<DocumentRequest> {
  const response = await fetchWithTimeout(`/api/cases/${caseId}/document-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<DocumentRequest>(response);
}

async function updateDocumentRequest(
  id: string,
  data: UpdateDocumentRequestData
): Promise<DocumentRequest> {
  const response = await fetchWithTimeout(`/api/document-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return parseApiResponse<DocumentRequest>(response);
}

async function deleteDocumentRequest(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/document-requests/${id}`, {
    method: 'DELETE',
  });
  await parseApiVoidResponse(response);
}

/**
 * Hook for fetching document requests for a case
 */
export function useDocumentRequests(caseId: string | undefined, pendingOnly = false) {
  return useQuery({
    queryKey: ['document-requests', caseId, pendingOnly],
    queryFn: () => fetchDocumentRequests(caseId!, pendingOnly),
    enabled: !!caseId,
    staleTime: 30 * 1000, // 30 seconds
    select: (data) => data.data,
  });
}

/**
 * Hook for creating a document request
 */
export function useCreateDocumentRequest(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDocumentRequestData) => {
      if (!caseId) throw new Error('Case ID is required');
      return createDocumentRequest(caseId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-requests', caseId] });
    },
  });
}

/**
 * Hook for updating a document request
 */
export function useUpdateDocumentRequest(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentRequestData }) =>
      updateDocumentRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-requests', caseId] });
    },
  });
}

/**
 * Hook for deleting a document request
 */
export function useDeleteDocumentRequest(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocumentRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-requests', caseId] });
    },
  });
}

/**
 * Hook for marking a request as uploaded (used by clients)
 */
export function useMarkRequestAsUploaded(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, documentId }: { requestId: string; documentId: string }) =>
      updateDocumentRequest(requestId, {
        status: 'uploaded',
        fulfilled_by_document_id: documentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-requests', caseId] });
    },
  });
}

/**
 * Hook for marking a request as fulfilled (used by attorneys)
 */
export function useMarkRequestAsFulfilled(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      updateDocumentRequest(requestId, {
        status: 'fulfilled',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-requests', caseId] });
    },
  });
}
