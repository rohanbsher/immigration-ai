import { BaseService } from './base-service';
import type { DocumentType, DocumentStatus } from '@/types';
import {
  encryptSensitiveFields,
  decryptSensitiveFields,
} from '@/lib/crypto';
import { auditService } from '@/lib/audit';

export interface Document {
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
}

export interface DocumentWithUploader extends Document {
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

export interface CreateDocumentData {
  case_id: string;
  document_type: DocumentType;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  expiration_date?: string;
  notes?: string;
}

export interface UpdateDocumentData {
  document_type?: DocumentType;
  status?: DocumentStatus;
  ai_extracted_data?: Record<string, unknown>;
  ai_confidence_score?: number;
  expiration_date?: string | null;
  notes?: string | null;
}

const DOCUMENT_SELECT = `
  *,
  uploader:profiles!documents_uploaded_by_fkey(id, first_name, last_name),
  verifier:profiles!documents_verified_by_fkey(id, first_name, last_name)
`;

class DocumentsService extends BaseService {
  constructor() {
    super('documents');
  }

  private decryptDocumentData(doc: Record<string, unknown>): Record<string, unknown> {
    if (doc.ai_extracted_data) {
      try {
        doc.ai_extracted_data = decryptSensitiveFields(
          doc.ai_extracted_data as Record<string, unknown>
        );
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          this.logger.logError('Decryption failed - refusing to return potentially encrypted data', err, { documentId: doc.id });
          throw new Error('Failed to decrypt document data');
        }
        this.logger.warn('Decryption failed, data may be unencrypted (legacy)', { documentId: doc.id as string });
      }
    }
    return doc;
  }

  async getDocumentsByCase(caseId: string): Promise<DocumentWithUploader[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('documents')
        .select(DOCUMENT_SELECT)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Decrypt sensitive fields in ai_extracted_data
      for (const doc of data || []) {
        this.decryptDocumentData(doc);
      }

      return (data || []) as DocumentWithUploader[];
    }, 'getDocumentsByCase', { caseId });
  }

  async getDocument(id: string): Promise<DocumentWithUploader | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('documents')
        .select(DOCUMENT_SELECT)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        return null;
      }

      this.decryptDocumentData(data);

      return data as DocumentWithUploader;
    }, 'getDocument', { documentId: id });
  }

  async createDocument(data: CreateDocumentData): Promise<Document> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data: newDocument, error } = await supabase
        .from('documents')
        .insert({
          ...data,
          uploaded_by: user.id,
          status: 'uploaded',
        })
        .select()
        .single();

      if (error) throw error;

      return newDocument;
    }, 'createDocument', { caseId: data.case_id, fileName: data.file_name });
  }

  async updateDocument(id: string, data: UpdateDocumentData): Promise<Document> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      // Encrypt sensitive fields in ai_extracted_data before storage
      const updateData = { ...data };
      if (updateData.ai_extracted_data) {
        try {
          updateData.ai_extracted_data = encryptSensitiveFields(
            updateData.ai_extracted_data as Record<string, unknown>
          );
        } catch (err) {
          if (process.env.NODE_ENV === 'production') {
            this.logger.logError('Encryption failed - refusing to store unencrypted PII', err, { documentId: id });
            throw new Error('Failed to encrypt document data');
          }
          this.logger.warn('Encryption failed, storing unencrypted (development only)', { documentId: id });
        }
      }

      const { data: updatedDocument, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedDocument;
    }, 'updateDocument', { documentId: id });
  }

  async verifyDocument(id: string): Promise<Document> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data: updatedDocument, error } = await supabase
        .from('documents')
        .update({
          status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return updatedDocument;
    }, 'verifyDocument', { documentId: id });
  }

  async deleteDocument(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    }, 'deleteDocument', { documentId: id });
  }

  async permanentlyDeleteDocument(id: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      // Fetch the document before deletion for audit trail
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (!document) {
        throw new Error('Document not found');
      }

      // Create audit log entry before deletion
      await auditService.logDelete(
        'documents',
        id,
        document as Record<string, unknown>,
        {
          additional_context: {
            deletion_type: 'permanent',
            reason: 'GDPR/compliance data removal',
          },
        } as { ip_address?: string; user_agent?: string }
      );

      // Two-step permanent delete: soft-delete first (set deleted_at),
      // then hard-delete. The enforce_soft_delete trigger only allows
      // hard DELETE when deleted_at IS NOT NULL.
      if (!document.deleted_at) {
        const { error: softDeleteError } = await supabase
          .from('documents')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (softDeleteError) throw softDeleteError;
      }

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }, 'permanentlyDeleteDocument', { documentId: id });
  }

  async restoreDocument(id: string): Promise<Document> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: restoredDocument, error } = await supabase
        .from('documents')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return restoredDocument;
    }, 'restoreDocument', { documentId: id });
  }

  async getDocumentChecklist(visaType: string): Promise<{
    document_type: DocumentType;
    required: boolean;
    description: string | null;
  }[]> {
    const result = await this.withNullableResult(async () => {
      const supabase = await this.getSupabaseClient();

      return supabase
        .from('document_checklists')
        .select('document_type, required, description')
        .eq('visa_type', visaType);
    }, 'getDocumentChecklist', { visaType });

    return result ?? [];
  }
}

// Export singleton instance
export const documentsService = new DocumentsService();
