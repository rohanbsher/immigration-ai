import { BaseService } from './base-service';
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

const REQUEST_SELECT = `
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
`;

const REQUEST_SELECT_NO_FULFILLED = `
  *,
  requester:profiles!requested_by (
    id,
    first_name,
    last_name,
    email
  )
`;

class DocumentRequestsService extends BaseService {
  constructor() {
    super('document-requests');
  }

  async getRequestsByCase(caseId: string): Promise<DocumentRequest[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('document_requests')
        .select(REQUEST_SELECT)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as DocumentRequest[];
    }, 'getRequestsByCase', { caseId });
  }

  async getPendingRequestsByCase(caseId: string): Promise<DocumentRequest[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('document_requests')
        .select(REQUEST_SELECT_NO_FULFILLED)
        .eq('case_id', caseId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      return data as DocumentRequest[];
    }, 'getPendingRequestsByCase', { caseId });
  }

  async getRequest(id: string): Promise<DocumentRequest | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('document_requests')
        .select(REQUEST_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as DocumentRequest;
    }, 'getRequest', { requestId: id });
  }

  async createRequest(data: CreateDocumentRequestData): Promise<DocumentRequest> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: request, error } = await supabase
        .from('document_requests')
        .insert({
          ...data,
          priority: data.priority || 'normal',
        })
        .select(REQUEST_SELECT_NO_FULFILLED)
        .single();

      if (error) throw error;

      return request as DocumentRequest;
    }, 'createRequest', { caseId: data.case_id, documentType: data.document_type });
  }

  async updateRequest(id: string, data: UpdateDocumentRequestData): Promise<DocumentRequest> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: request, error } = await supabase
        .from('document_requests')
        .update(data)
        .eq('id', id)
        .select(REQUEST_SELECT)
        .single();

      if (error) throw error;

      return request as DocumentRequest;
    }, 'updateRequest', { requestId: id });
  }

  async markAsUploaded(id: string, documentId: string): Promise<DocumentRequest> {
    return this.updateRequest(id, {
      status: 'uploaded',
      fulfilled_by_document_id: documentId,
    });
  }

  async markAsFulfilled(id: string): Promise<DocumentRequest> {
    return this.updateRequest(id, {
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
    });
  }

  async cancelRequest(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('document_requests')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
    }, 'cancelRequest', { requestId: id });
  }

  async deleteRequest(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('document_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'deleteRequest', { requestId: id });
  }

  async getPendingCount(caseId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { count, error } = await supabase
        .from('document_requests')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', caseId)
        .eq('status', 'pending')
        .is('deleted_at', null);

      if (error) throw error;

      return count || 0;
    }, 'getPendingCount', { caseId });
  }
}

// Export singleton instance
export const documentRequestsService = new DocumentRequestsService();
