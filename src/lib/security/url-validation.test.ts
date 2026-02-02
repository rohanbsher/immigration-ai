import { describe, it, expect } from 'vitest';
import { validateStorageUrl, STORAGE_URL_CONFIG } from './url-validation';

const MOCK_SUPABASE_URL = 'https://test-project.supabase.co';

describe('validateStorageUrl', () => {
  const options = { supabaseUrl: MOCK_SUPABASE_URL };

  describe('valid URLs', () => {
    it('should accept valid Supabase storage URL for documents bucket', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/case-123/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(true);
    });

    it('should accept authenticated storage URL', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/authenticated/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(true);
    });

    it('should accept URL with nested paths', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/case/sub/deep/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(true);
    });

    it('should accept URLs with query parameters', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/file.pdf?token=abc';
      expect(validateStorageUrl(url, options)).toBe(true);
    });

    it('should accept URLs with special characters in filename', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/file%20with%20spaces.pdf';
      expect(validateStorageUrl(url, options)).toBe(true);
    });

    it('should accept very long URLs', () => {
      const longPath = 'a'.repeat(1000);
      const url = `https://test-project.supabase.co/storage/v1/object/public/documents/${longPath}.pdf`;
      expect(validateStorageUrl(url, options)).toBe(true);
    });
  });

  describe('origin validation', () => {
    it('should reject URLs with different hostname', () => {
      const url = 'https://evil.com/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with subdomain injection', () => {
      const url = 'https://test-project.supabase.co.evil.com/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with different port', () => {
      const url = 'https://test-project.supabase.co:8080/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });
  });

  describe('protocol validation', () => {
    it('should reject HTTP URLs', () => {
      const url = 'http://test-project.supabase.co/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject file:// protocol', () => {
      const url = 'file:///etc/passwd';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      const url = 'javascript:alert(1)';
      expect(validateStorageUrl(url, options)).toBe(false);
    });
  });

  describe('path traversal prevention', () => {
    it('should reject URLs with path traversal (..) in path', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/../../../etc/passwd';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with URL-encoded path traversal', () => {
      // Note: URL parser decodes %2e%2e to .. so this should be caught
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/%2e%2e/secret';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with double slashes', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents//hidden/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });
  });

  describe('path validation', () => {
    it('should reject URLs without storage prefix', () => {
      const url = 'https://test-project.supabase.co/api/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with incorrect storage path', () => {
      const url = 'https://test-project.supabase.co/storage/v2/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should handle URLs with fragment (fragment is ignored by URL parser for path)', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/file.pdf#/etc/passwd';
      expect(validateStorageUrl(url, options)).toBe(true);
    });
  });

  describe('bucket allowlist', () => {
    it('should reject URLs to non-allowed buckets', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/avatars/user.png';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs to private bucket', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/secret-files/data.json';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs with bucket name that contains documents as substring', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/my-documents-backup/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should accept custom allowed buckets via options', () => {
      const customOptions = {
        supabaseUrl: MOCK_SUPABASE_URL,
        allowedBuckets: ['documents', 'avatars'],
      };
      const url = 'https://test-project.supabase.co/storage/v1/object/public/avatars/user.png';
      expect(validateStorageUrl(url, customOptions)).toBe(true);
    });
  });

  describe('malformed URLs', () => {
    it('should reject empty string', () => {
      expect(validateStorageUrl('', options)).toBe(false);
    });

    it('should reject null-like values', () => {
      expect(validateStorageUrl('null', options)).toBe(false);
      expect(validateStorageUrl('undefined', options)).toBe(false);
    });

    it('should reject URLs with missing bucket', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/public/';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject URLs that are too short', () => {
      const url = 'https://test-project.supabase.co/storage/v1/object/';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject internal IPs', () => {
      const url = 'https://192.168.1.1/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });

    it('should reject localhost', () => {
      const url = 'https://localhost/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, options)).toBe(false);
    });
  });

  describe('missing configuration', () => {
    it('should return false when supabaseUrl is not provided and env var is missing', () => {
      // Without options.supabaseUrl and no env var, should return false
      const url = 'https://test-project.supabase.co/storage/v1/object/public/documents/file.pdf';
      expect(validateStorageUrl(url, { supabaseUrl: undefined })).toBe(false);
    });
  });

  describe('STORAGE_URL_CONFIG', () => {
    it('should have documents in default allowed buckets', () => {
      expect(STORAGE_URL_CONFIG.allowedBuckets).toContain('documents');
    });

    it('should have correct storage path', () => {
      expect(STORAGE_URL_CONFIG.storagePath).toBe('/storage/v1/object/');
    });
  });
});
