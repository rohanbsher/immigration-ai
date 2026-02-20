import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockQueryBuilder,
  mockUser,
  resetMocks,
} from '@/__mocks__/supabase';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/crypto', () => ({
  encryptSensitiveFields: vi.fn((data) => ({ ...data, _encrypted: true })),
  decryptSensitiveFields: vi.fn((data) => data),
}));

vi.mock('@/lib/audit', () => ({
  auditService: {
    logDelete: vi.fn().mockResolvedValue(null),
  },
}));

import { documentsService } from './documents';
import { encryptSensitiveFields, decryptSensitiveFields } from '@/lib/crypto';
import { auditService } from '@/lib/audit';

const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  case_id: 'case-123',
  uploaded_by: 'user-123',
  document_type: 'passport',
  status: 'uploaded',
  scan_status: null,
  file_name: 'passport.pdf',
  file_url: 'https://storage.example.com/passport.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  ai_extracted_data: null,
  ai_confidence_score: null,
  verified_by: null,
  verified_at: null,
  expiration_date: '2030-01-01',
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
  uploader: {
    id: 'user-123',
    first_name: 'Test',
    last_name: 'Uploader',
  },
  verifier: null,
  ...overrides,
});

describe('DocumentsService', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('getDocumentsByCase', () => {
    it('should fetch documents for a case', async () => {
      const mockDocs = [createMockDocument(), createMockDocument({ id: 'doc-456' })];
      const queryBuilder = createMockQueryBuilder(mockDocs);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocumentsByCase('case-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('documents');
      expect(queryBuilder.eq).toHaveBeenCalledWith('case_id', 'case-123');
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(2);
    });

    it('should decrypt ai_extracted_data when present', async () => {
      const mockDoc = createMockDocument({
        ai_extracted_data: { passport_number: 'encrypted_value' },
      });
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.getDocumentsByCase('case-123');

      expect(decryptSensitiveFields).toHaveBeenCalledWith(
        expect.objectContaining({ passport_number: 'encrypted_value' })
      );
    });

    it('should not call decrypt when ai_extracted_data is null', async () => {
      const mockDoc = createMockDocument({ ai_extracted_data: null });
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.getDocumentsByCase('case-123');

      expect(decryptSensitiveFields).not.toHaveBeenCalled();
    });

    it('should return empty array when no documents found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocumentsByCase('case-123');

      expect(result).toEqual([]);
    });

    it('should throw error when query fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(documentsService.getDocumentsByCase('case-123')).rejects.toThrow();
    });
  });

  describe('getDocument', () => {
    it('should fetch a single document by id', async () => {
      const mockDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocument('doc-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('documents');
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryBuilder.single).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should return null when document not found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocument('non-existent');

      expect(result).toBeNull();
    });

    it('should decrypt ai_extracted_data on single document', async () => {
      const mockDoc = createMockDocument({
        ai_extracted_data: { name: 'encrypted' },
      });
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.getDocument('doc-123');

      expect(decryptSensitiveFields).toHaveBeenCalled();
    });
  });

  describe('createDocument', () => {
    it('should create a new document with required fields', async () => {
      const mockDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const createData = {
        case_id: 'case-123',
        document_type: 'passport' as const,
        file_name: 'passport.pdf',
        file_url: 'https://storage.example.com/passport.pdf',
        file_size: 1024000,
        mime_type: 'application/pdf',
      };

      const result = await documentsService.createDocument(createData, mockUser.id);

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        ...createData,
        uploaded_by: mockUser.id,
        status: 'uploaded',
      });
      expect(queryBuilder.select).toHaveBeenCalled();
      expect(queryBuilder.single).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should always set initial status to uploaded', async () => {
      const mockDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.createDocument(
        {
          case_id: 'c',
          document_type: 'passport',
          file_name: 'test.pdf',
          file_url: 'https://example.com/test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
        },
        'user-1'
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'uploaded' })
      );
    });

    it('should include optional fields', async () => {
      const mockDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([mockDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.createDocument(
        {
          case_id: 'c',
          document_type: 'passport',
          file_name: 'test.pdf',
          file_url: 'https://example.com/test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          scan_status: 'clean',
          expiration_date: '2030-12-31',
          notes: 'Extra notes',
        },
        'user-1'
      );

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          scan_status: 'clean',
          expiration_date: '2030-12-31',
          notes: 'Extra notes',
        })
      );
    });

    it('should throw error when insert fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.createDocument(
          {
            case_id: 'c',
            document_type: 'passport',
            file_name: 'f',
            file_url: 'u',
            file_size: 1,
            mime_type: 'm',
          },
          'user-1'
        )
      ).rejects.toThrow();
    });
  });

  describe('updateDocument', () => {
    it('should update document fields', async () => {
      const updatedDoc = createMockDocument({ status: 'analyzed' });
      const queryBuilder = createMockQueryBuilder([updatedDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.updateDocument('doc-123', {
        status: 'analyzed',
        ai_confidence_score: 0.95,
      });

      expect(queryBuilder.update).toHaveBeenCalled();
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(result).toBeDefined();
    });

    it('should encrypt ai_extracted_data before storing', async () => {
      const updatedDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([updatedDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.updateDocument('doc-123', {
        ai_extracted_data: { name: 'John Doe' },
      });

      expect(encryptSensitiveFields).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'John Doe' })
      );
    });

    it('should not call encrypt when ai_extracted_data is not provided', async () => {
      const updatedDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([updatedDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.updateDocument('doc-123', {
        status: 'verified',
      });

      expect(encryptSensitiveFields).not.toHaveBeenCalled();
    });

    it('should throw error when update fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.updateDocument('doc-123', { status: 'verified' })
      ).rejects.toThrow();
    });
  });

  describe('verifyDocument', () => {
    it('should mark document as verified with userId and timestamp', async () => {
      const verifiedDoc = createMockDocument({ status: 'verified' });
      const queryBuilder = createMockQueryBuilder([verifiedDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.verifyDocument('doc-123', mockUser.id);

      expect(queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'verified',
          verified_by: mockUser.id,
          verified_at: expect.any(String),
        })
      );
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(queryBuilder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(result).toBeDefined();
    });

    it('should set verified_at to a valid ISO timestamp', async () => {
      const verifiedDoc = createMockDocument();
      const queryBuilder = createMockQueryBuilder([verifiedDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.verifyDocument('doc-123', 'verifier-id');

      const updateCall = queryBuilder.update.mock.calls[0][0];
      expect(new Date(updateCall.verified_at).toISOString()).toBe(updateCall.verified_at);
    });

    it('should throw error when verify fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Verify failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.verifyDocument('doc-123', mockUser.id)
      ).rejects.toThrow();
    });
  });

  describe('deleteDocument', () => {
    it('should soft-delete a document', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await documentsService.deleteDocument('doc-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('documents');
      expect(queryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
    });

    it('should throw error when delete fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(documentsService.deleteDocument('doc-123')).rejects.toThrow();
    });
  });

  describe('permanentlyDeleteDocument', () => {
    it('should soft-delete then hard-delete when deleted_at is null', async () => {
      const mockDoc = createMockDocument({ deleted_at: null });
      const fetchQueryBuilder = createMockQueryBuilder([mockDoc]);
      const softDeleteQueryBuilder = createMockQueryBuilder([]);
      softDeleteQueryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });
      const deleteQueryBuilder = createMockQueryBuilder([]);
      deleteQueryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from
        .mockReturnValueOnce(fetchQueryBuilder)
        .mockReturnValueOnce(softDeleteQueryBuilder)
        .mockReturnValueOnce(deleteQueryBuilder);

      await documentsService.permanentlyDeleteDocument('doc-123');

      expect(auditService.logDelete).toHaveBeenCalledWith(
        'documents',
        'doc-123',
        expect.any(Object),
        expect.objectContaining({
          additional_context: expect.objectContaining({
            deletion_type: 'permanent',
          }),
        })
      );
      expect(softDeleteQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(deleteQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should skip soft-delete when already soft-deleted', async () => {
      const mockDoc = createMockDocument({ deleted_at: '2024-06-01T00:00:00Z' });
      const fetchQueryBuilder = createMockQueryBuilder([mockDoc]);
      const deleteQueryBuilder = createMockQueryBuilder([]);
      deleteQueryBuilder.eq = vi.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from
        .mockReturnValueOnce(fetchQueryBuilder)
        .mockReturnValueOnce(deleteQueryBuilder);

      await documentsService.permanentlyDeleteDocument('doc-123');

      expect(deleteQueryBuilder.delete).toHaveBeenCalled();
      // Only 2 from() calls, not 3
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should throw when document not found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.permanentlyDeleteDocument('non-existent')
      ).rejects.toThrow('Document not found');
    });

    it('should throw when fetch errors', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Fetch failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.permanentlyDeleteDocument('doc-123')
      ).rejects.toThrow();
    });
  });

  describe('restoreDocument', () => {
    it('should restore a soft-deleted document', async () => {
      const restoredDoc = createMockDocument({ deleted_at: null });
      const queryBuilder = createMockQueryBuilder([restoredDoc]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.restoreDocument('doc-123');

      expect(queryBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(result).toBeDefined();
    });

    it('should throw error when restore fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Restore failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        documentsService.restoreDocument('doc-123')
      ).rejects.toThrow();
    });
  });

  describe('getDocumentChecklist', () => {
    it('should fetch checklist for a visa type', async () => {
      const mockChecklist = [
        { document_type: 'passport', required: true, description: 'Valid passport' },
        { document_type: 'photo', required: true, description: 'Passport photo' },
      ];
      const queryBuilder = createMockQueryBuilder(mockChecklist);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocumentChecklist('H1B');

      expect(mockSupabase.from).toHaveBeenCalledWith('document_checklists');
      expect(queryBuilder.eq).toHaveBeenCalledWith('visa_type', 'H1B');
      expect(result).toHaveLength(2);
      expect(result[0].document_type).toBe('passport');
    });

    it('should return empty array on error', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocumentChecklist('H1B');

      expect(result).toEqual([]);
    });

    it('should return empty array when no checklist items found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await documentsService.getDocumentChecklist('UNKNOWN_VISA');

      expect(result).toEqual([]);
    });
  });
});
