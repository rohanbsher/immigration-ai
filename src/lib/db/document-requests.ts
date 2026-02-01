import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import type { DocumentType } from '@/types';

const logger = createLogger('db:document-requests');

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
  deleted_at: string | null;
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

export interface CreateDocumentRequestData {
  case_id: string;
  requested_by: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  due_date?: string;
  priority?: RequestPriority;
}

export interface UpdateDocumentRequestData {
  status?: DocumentRequestStatus;
  title?: string;
  description?: string | null;
  due_date?: string | null;
  priority?: RequestPriority;
  fulfilled_by_document_id?: string | null;
  fulfilled_at?: string | null;
}

export const documentRequestsService = {
  /**
   * Get all document requests for a case
   */
  async getRequestsByCase(caseId: string): Promise<DocumentRequest[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        requester:profiles!requested_by (
          id,
          first_name,
          last_name,
          email
        ),
        fulfilled_document:documents!fulfilled_by_document_id (
          id,
          file_name,
          file_url
        )
      `)
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.logError('Error fetching document requests', error, { caseId });
      throw error;
    }

    return data as DocumentRequest[];
  },

  /**
   * Get pending requests for a case
   */
  async getPendingRequestsByCase(caseId: string): Promise<DocumentRequest[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        requester:profiles!requested_by (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      logger.logError('Error fetching pending requests', error, { caseId });
      throw error;
    }

    return data as DocumentRequest[];
  },

  /**
   * Get a single document request
   */
  async getRequest(id: string): Promise<DocumentRequest | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_requests')
      .select(`
        *,
        requester:profiles!requested_by (
          id,
          first_name,
          last_name,
          email
        ),
        fulfilled_document:documents!fulfilled_by_document_id (
          id,
          file_name,
          file_url
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.logError('Error fetching document request', error, { requestId: id });
      throw error;
    }

    return data as DocumentRequest;
  },

  /**
   * Create a new document request
   */
  async createRequest(data: CreateDocumentRequestData): Promise<DocumentRequest> {
    const supabase = await createClient();

    const { data: request, error } = await supabase
      .from('document_requests')
      .insert({
        ...data,
        priority: data.priority || 'normal',
      })
      .select(`
        *,
        requester:profiles!requested_by (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) {
      logger.logError('Error creating document request', error, { caseId: data.case_id, documentType: data.document_type });
      throw error;
    }

    return request as DocumentRequest;
  },

  /**
   * Update a document request
   */
  async updateRequest(id: string, data: UpdateDocumentRequestData): Promise<DocumentRequest> {
    const supabase = await createClient();

    const { data: request, error } = await supabase
      .from('document_requests')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        requester:profiles!requested_by (
          id,
          first_name,
          last_name,
          email
        ),
        fulfilled_document:documents!fulfilled_by_document_id (
          id,
          file_name,
          file_url
        )
      `)
      .single();

    if (error) {
      logger.logError('Error updating document request', error, { requestId: id });
      throw error;
    }

    return request as DocumentRequest;
  },

  /**
   * Mark a request as uploaded (when client uploads a document)
   */
  async markAsUploaded(id: string, documentId: string): Promise<DocumentRequest> {
    return this.updateRequest(id, {
      status: 'uploaded',
      fulfilled_by_document_id: documentId,
    });
  },

  /**
   * Mark a request as fulfilled (when attorney verifies the document)
   */
  async markAsFulfilled(id: string): Promise<DocumentRequest> {
    return this.updateRequest(id, {
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
    });
  },

  /**
   * Cancel a request
   */
  async cancelRequest(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('document_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      logger.logError('Error cancelling document request', error, { requestId: id });
      throw error;
    }
  },

  /**
   * Soft delete a request
   */
  async deleteRequest(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('document_requests')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.logError('Error deleting document request', error, { requestId: id });
      throw error;
    }
  },

  /**
   * Get count of pending requests for a case
   */
  async getPendingCount(caseId: string): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('document_requests')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .is('deleted_at', null);

    if (error) {
      logger.logError('Error fetching pending count', error, { caseId });
      return 0;
    }

    return count || 0;
  },
};
