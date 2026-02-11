import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { storage, serverStorage, SIGNED_URL_EXPIRATION } from './index';

const mockUpload = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockList = vi.fn();

const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  download: mockDownload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
  createSignedUrl: mockCreateSignedUrl,
  list: mockList,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

describe('Storage Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SIGNED_URL_EXPIRATION constants', () => {
    it('should have correct expiration times', () => {
      expect(SIGNED_URL_EXPIRATION.AI_PROCESSING).toBe(600);
      expect(SIGNED_URL_EXPIRATION.USER_DOWNLOAD).toBe(300);
      expect(SIGNED_URL_EXPIRATION.PREVIEW).toBe(900);
      expect(SIGNED_URL_EXPIRATION.DEFAULT).toBe(3600);
    });
  });

  describe('storage (client-side)', () => {
    describe('uploadFile', () => {
      it('should upload a file successfully', async () => {
        const mockFile = new File(['content'], 'test.pdf', {
          type: 'application/pdf',
        });
        const mockData = { path: 'case-123/test.pdf' };

        mockUpload.mockResolvedValueOnce({ data: mockData, error: null });

        const result = await storage.uploadFile({
          bucket: 'documents',
          path: 'case-123/test.pdf',
          file: mockFile,
        });

        expect(mockStorageFrom).toHaveBeenCalledWith('documents');
        expect(mockUpload).toHaveBeenCalledWith(
          'case-123/test.pdf',
          mockFile,
          { upsert: false, contentType: 'application/pdf' }
        );
        expect(result).toEqual(mockData);
      });

      it('should upload with upsert option', async () => {
        const mockFile = new File(['content'], 'test.pdf', {
          type: 'application/pdf',
        });

        mockUpload.mockResolvedValueOnce({
          data: { path: 'test.pdf' },
          error: null,
        });

        await storage.uploadFile({
          bucket: 'documents',
          path: 'test.pdf',
          file: mockFile,
          upsert: true,
        });

        expect(mockUpload).toHaveBeenCalledWith('test.pdf', mockFile, {
          upsert: true,
          contentType: 'application/pdf',
        });
      });

      it('should throw error on upload failure', async () => {
        const mockFile = new File(['content'], 'test.pdf', {
          type: 'application/pdf',
        });
        const mockError = new Error('Upload failed');

        mockUpload.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(
          storage.uploadFile({
            bucket: 'documents',
            path: 'test.pdf',
            file: mockFile,
          })
        ).rejects.toThrow('Upload failed');
      });
    });

    describe('downloadFile', () => {
      it('should download a file successfully', async () => {
        const mockBlob = new Blob(['file content']);

        mockDownload.mockResolvedValueOnce({ data: mockBlob, error: null });

        const result = await storage.downloadFile('documents', 'case-123/test.pdf');

        expect(mockStorageFrom).toHaveBeenCalledWith('documents');
        expect(mockDownload).toHaveBeenCalledWith('case-123/test.pdf');
        expect(result).toBe(mockBlob);
      });

      it('should throw error on download failure', async () => {
        const mockError = new Error('Download failed');

        mockDownload.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(
          storage.downloadFile('documents', 'nonexistent.pdf')
        ).rejects.toThrow('Download failed');
      });
    });

    describe('deleteFile', () => {
      it('should delete a single file successfully', async () => {
        mockRemove.mockResolvedValueOnce({ error: null });

        await storage.deleteFile('documents', 'case-123/test.pdf');

        expect(mockStorageFrom).toHaveBeenCalledWith('documents');
        expect(mockRemove).toHaveBeenCalledWith(['case-123/test.pdf']);
      });

      it('should throw error on delete failure', async () => {
        const mockError = new Error('Delete failed');

        mockRemove.mockResolvedValueOnce({ error: mockError });

        await expect(
          storage.deleteFile('documents', 'test.pdf')
        ).rejects.toThrow('Delete failed');
      });
    });

    describe('deleteFiles', () => {
      it('should delete multiple files successfully', async () => {
        mockRemove.mockResolvedValueOnce({ error: null });

        const paths = ['file1.pdf', 'file2.pdf', 'file3.pdf'];
        await storage.deleteFiles('documents', paths);

        expect(mockRemove).toHaveBeenCalledWith(paths);
      });

      it('should throw error on batch delete failure', async () => {
        const mockError = new Error('Batch delete failed');

        mockRemove.mockResolvedValueOnce({ error: mockError });

        await expect(
          storage.deleteFiles('documents', ['file1.pdf'])
        ).rejects.toThrow('Batch delete failed');
      });
    });

    describe('getPublicUrl', () => {
      it('should return public URL for non-documents bucket', () => {
        const mockUrl = 'https://storage.example.com/avatars/photo.png';

        mockGetPublicUrl.mockReturnValueOnce({ data: { publicUrl: mockUrl } });

        const result = storage.getPublicUrl('avatars', 'photo.png');

        expect(mockStorageFrom).toHaveBeenCalledWith('avatars');
        expect(mockGetPublicUrl).toHaveBeenCalledWith('photo.png');
        expect(result).toBe(mockUrl);
      });

      it('should throw for documents bucket', () => {
        expect(() => storage.getPublicUrl('documents', 'test.pdf')).toThrow(
          'Documents bucket requires signed URLs'
        );
      });
    });

    describe('getSignedUrl', () => {
      it('should return signed URL with default expiration', async () => {
        const mockUrl = 'https://storage.example.com/documents/test.pdf?token=abc';

        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: mockUrl },
          error: null,
        });

        const result = await storage.getSignedUrl('documents', 'test.pdf');

        expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 3600);
        expect(result).toBe(mockUrl);
      });

      it('should return signed URL with custom expiration', async () => {
        const mockUrl = 'https://storage.example.com/documents/test.pdf?token=abc';

        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: mockUrl },
          error: null,
        });

        const result = await storage.getSignedUrl('documents', 'test.pdf', 600);

        expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 600);
        expect(result).toBe(mockUrl);
      });

      it('should throw error on signed URL failure', async () => {
        const mockError = new Error('Signed URL failed');

        mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(
          storage.getSignedUrl('documents', 'test.pdf')
        ).rejects.toThrow('Signed URL failed');
      });
    });

    describe('listFiles', () => {
      it('should list files in bucket root', async () => {
        const mockFiles = [
          {
            name: 'file1.pdf',
            id: '1',
            updated_at: '2024-01-01',
            created_at: '2024-01-01',
            last_accessed_at: '2024-01-01',
            metadata: {},
          },
          {
            name: 'file2.pdf',
            id: '2',
            updated_at: '2024-01-02',
            created_at: '2024-01-02',
            last_accessed_at: '2024-01-02',
            metadata: {},
          },
        ];

        mockList.mockResolvedValueOnce({ data: mockFiles, error: null });

        const result = await storage.listFiles('documents');

        expect(mockStorageFrom).toHaveBeenCalledWith('documents');
        expect(mockList).toHaveBeenCalledWith(undefined);
        expect(result).toEqual(mockFiles);
      });

      it('should list files in a specific folder', async () => {
        const mockFiles = [
          {
            name: 'file.pdf',
            id: '1',
            updated_at: '2024-01-01',
            created_at: '2024-01-01',
            last_accessed_at: '2024-01-01',
            metadata: {},
          },
        ];

        mockList.mockResolvedValueOnce({ data: mockFiles, error: null });

        const result = await storage.listFiles('documents', 'case-123');

        expect(mockList).toHaveBeenCalledWith('case-123');
        expect(result).toEqual(mockFiles);
      });

      it('should throw error on list failure', async () => {
        const mockError = new Error('List failed');

        mockList.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(storage.listFiles('documents')).rejects.toThrow('List failed');
      });
    });
  });

  describe('serverStorage', () => {
    describe('uploadFile', () => {
      it('should upload a file on the server', async () => {
        const mockFile = new File(['content'], 'test.pdf', {
          type: 'application/pdf',
        });
        const mockData = { path: 'test.pdf' };

        mockUpload.mockResolvedValueOnce({ data: mockData, error: null });

        const result = await serverStorage.uploadFile({
          bucket: 'documents',
          path: 'test.pdf',
          file: mockFile,
        });

        expect(result).toEqual(mockData);
      });

      it('should throw error on server upload failure', async () => {
        const mockFile = new File(['content'], 'test.pdf', {
          type: 'application/pdf',
        });
        const mockError = new Error('Server upload failed');

        mockUpload.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(
          serverStorage.uploadFile({
            bucket: 'documents',
            path: 'test.pdf',
            file: mockFile,
          })
        ).rejects.toThrow('Server upload failed');
      });
    });

    describe('deleteFile', () => {
      it('should delete a file on the server', async () => {
        mockRemove.mockResolvedValueOnce({ error: null });

        await serverStorage.deleteFile('documents', 'test.pdf');

        expect(mockRemove).toHaveBeenCalledWith(['test.pdf']);
      });

      it('should throw error on server delete failure', async () => {
        const mockError = new Error('Server delete failed');

        mockRemove.mockResolvedValueOnce({ error: mockError });

        await expect(
          serverStorage.deleteFile('documents', 'test.pdf')
        ).rejects.toThrow('Server delete failed');
      });
    });

    describe('getPublicUrl', () => {
      it('should construct public URL from environment for non-documents bucket', () => {
        const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';

        const result = serverStorage.getPublicUrl('avatars', 'photo.png');

        expect(result).toBe(
          'https://project.supabase.co/storage/v1/object/public/avatars/photo.png'
        );

        process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
      });

      it('should throw for documents bucket', () => {
        expect(() => serverStorage.getPublicUrl('documents', 'test.pdf')).toThrow(
          'Documents bucket requires signed URLs'
        );
      });
    });

    describe('getSignedUrl', () => {
      it('should return signed URL on server', async () => {
        const mockUrl = 'https://storage.example.com/signed/test.pdf';

        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: mockUrl },
          error: null,
        });

        const result = await serverStorage.getSignedUrl('documents', 'test.pdf');

        expect(result).toBe(mockUrl);
      });

      it('should use custom expiration time', async () => {
        const mockUrl = 'https://storage.example.com/signed/test.pdf';

        mockCreateSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: mockUrl },
          error: null,
        });

        await serverStorage.getSignedUrl('documents', 'test.pdf', 600);

        expect(mockCreateSignedUrl).toHaveBeenCalledWith('test.pdf', 600);
      });

      it('should throw error on server signed URL failure', async () => {
        const mockError = new Error('Server signed URL failed');

        mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: mockError });

        await expect(
          serverStorage.getSignedUrl('documents', 'test.pdf')
        ).rejects.toThrow('Server signed URL failed');
      });
    });
  });
});
