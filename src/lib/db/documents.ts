import { createClient } from '@/lib/supabase/server';
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

export const documentsService = {
  async getDocumentsByCase(caseId: string): Promise<DocumentWithUploader[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!documents_uploaded_by_fkey(id, first_name, last_name),
        verifier:profiles!documents_verified_by_fkey(id, first_name, last_name)
      `)
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }

    // Decrypt sensitive fields in ai_extracted_data
    const documents = (data || []).map((doc) => {
      if (doc.ai_extracted_data) {
        try {
          doc.ai_extracted_data = decryptSensitiveFields(
            doc.ai_extracted_data as Record<string, unknown>
          );
        } catch {
          // If decryption fails, data may be unencrypted (legacy) - leave as-is
        }
      }
      return doc;
    });

    return documents as DocumentWithUploader[];
  },

  async getDocument(id: string): Promise<DocumentWithUploader | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!documents_uploaded_by_fkey(id, first_name, last_name),
        verifier:profiles!documents_verified_by_fkey(id, first_name, last_name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      return null;
    }

    // Decrypt sensitive fields in ai_extracted_data
    if (data.ai_extracted_data) {
      try {
        data.ai_extracted_data = decryptSensitiveFields(
          data.ai_extracted_data as Record<string, unknown>
        );
      } catch {
        // If decryption fails, data may be unencrypted (legacy) - leave as-is
      }
    }

    return data as DocumentWithUploader;
  },

  async createDocument(data: CreateDocumentData): Promise<Document> {
    const supabase = await createClient();

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

    if (error) {
      console.error('Error creating document:', error);
      throw error;
    }

    return newDocument;
  },

  async updateDocument(id: string, data: UpdateDocumentData): Promise<Document> {
    const supabase = await createClient();

    // Encrypt sensitive fields in ai_extracted_data before storage
    const updateData = { ...data };
    if (updateData.ai_extracted_data) {
      try {
        updateData.ai_extracted_data = encryptSensitiveFields(
          updateData.ai_extracted_data as Record<string, unknown>
        );
      } catch (err) {
        console.error('Error encrypting ai_extracted_data:', err);
        // Continue without encryption if ENCRYPTION_KEY is not set
        // This allows development without encryption configured
      }
    }

    const { data: updatedDocument, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating document:', error);
      throw error;
    }

    return updatedDocument;
  },

  async verifyDocument(id: string): Promise<Document> {
    const supabase = await createClient();

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

    if (error) {
      console.error('Error verifying document:', error);
      throw error;
    }

    return updatedDocument;
  },

  /**
   * Soft delete a document by setting deleted_at timestamp.
   * The document is not permanently removed from the database.
   */
  async deleteDocument(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  /**
   * Permanently delete a document. Use with caution.
   * This should only be used for compliance/GDPR data removal requests.
   * Creates an audit trail before deletion for compliance.
   */
  async permanentlyDeleteDocument(id: string): Promise<void> {
    const supabase = await createClient();

    // Fetch the document before deletion for audit trail
    // Note: We query without soft-delete filter to allow permanent deletion of soft-deleted docs
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching document for audit:', fetchError);
      throw fetchError;
    }

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

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error permanently deleting document:', error);
      throw error;
    }
  },

  /**
   * Restore a soft-deleted document.
   */
  async restoreDocument(id: string): Promise<Document> {
    const supabase = await createClient();

    const { data: restoredDocument, error } = await supabase
      .from('documents')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error restoring document:', error);
      throw error;
    }

    return restoredDocument;
  },

  async getDocumentChecklist(visaType: string): Promise<{
    document_type: DocumentType;
    required: boolean;
    description: string | null;
  }[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_checklists')
      .select('document_type, required, description')
      .eq('visa_type', visaType);

    if (error) {
      console.error('Error fetching document checklist:', error);
      return [];
    }

    return data || [];
  },
};
