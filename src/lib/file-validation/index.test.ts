/**
 * Unit tests for file validation service.
 * Tests magic byte validation, MIME type checking, and virus scanning.
 */

import { describe, test, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  validateFileType,
  validateFile,
  scanFileForViruses,
  ALLOWED_MIME_TYPES,
} from './index';
import {
  createMockFile,
  createSpoofedFile,
  createFileFromBytes,
} from '@/test-utils/factories';

// Mock the logger to avoid console noise during tests
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Polyfill for Blob.prototype.arrayBuffer in jsdom environment
beforeAll(() => {
  if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function(): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe('File Validation Service', () => {
  describe('detectMimeTypeFromContent (tested via validateFileType)', () => {
    test('should detect PDF from magic bytes', async () => {
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('application/pdf');
    });

    test('should detect PNG from magic bytes', async () => {
      const file = createMockFile({
        name: 'image.png',
        type: 'image/png',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    test('should detect JPEG from magic bytes', async () => {
      const file = createMockFile({
        name: 'photo.jpg',
        type: 'image/jpeg',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/jpeg');
    });

    test('should detect GIF from magic bytes', async () => {
      const file = createMockFile({
        name: 'animation.gif',
        type: 'image/gif',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/gif');
    });

    test('should detect WebP from magic bytes', async () => {
      // WebP has RIFF header + WEBP at offset 8
      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // File size placeholder
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x00, 0x00, 0x00, 0x00, // Padding
      ]);
      const file = createFileFromBytes(webpBytes, 'image.webp', 'image/webp');

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/webp');
    });
  });

  describe('validateFileType', () => {
    test('should reject file with no name', async () => {
      // Create a file-like object with empty name
      const content = new TextEncoder().encode('content');
      const file = createFileFromBytes(content, '', 'application/pdf');

      const result = await validateFileType(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must have a name');
    });

    test('should reject file with no extension', async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      const file = createFileFromBytes(pdfBytes, 'document', 'application/pdf');

      const result = await validateFileType(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must have an extension');
    });

    test('should reject file with invalid extension', async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = createFileFromBytes(content, 'script.exe', 'application/octet-stream');

      const result = await validateFileType(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    test('should reject file with invalid MIME type', async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      const file = createFileFromBytes(pdfBytes, 'document.pdf', 'application/octet-stream');

      const result = await validateFileType(file);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('MIME type');
    });

    test('should detect spoofed extension (EXE disguised as PDF)', async () => {
      const file = createSpoofedFile({
        name: 'malware.pdf',
        claimedType: 'application/pdf',
        actualContent: 'exe',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(false);
      // The error should indicate the file content doesn't match the extension
      expect(result.error).toBeDefined();
    });

    test('should pass valid PDF file', async () => {
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('application/pdf');
      expect(result.warnings).toHaveLength(0);
    });

    test('should pass valid image file', async () => {
      const file = createMockFile({
        name: 'photo.png',
        type: 'image/png',
      });

      const result = await validateFileType(file);

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
    });

    test('should handle MIME type consistency check with warning', async () => {
      // Test the warning scenario: PNG file content with .png extension and valid but
      // different claimed MIME type. The validation passes because:
      // 1. Extension .png is allowed
      // 2. Claimed MIME image/jpeg is in ALLOWED_MIME_TYPES
      // 3. Detected MIME (image/png) matches the extension
      // But a warning is generated because claimed != detected
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = createFileFromBytes(pngBytes, 'image.png', 'image/jpeg');

      const result = await validateFileType(file);

      // The validation passes because detected type (PNG) matches extension (.png)
      // But there should be a warning about the claimed vs detected MIME type mismatch
      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe('image/png');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('differs from detected');
    });
  });

  describe('scanFileForViruses', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should return clean for safe file with mock scanner', async () => {
      process.env.NODE_ENV = 'test';
      const file = createMockFile({
        name: 'safe.pdf',
        type: 'application/pdf',
      });

      const result = await scanFileForViruses(file, { provider: 'mock' });

      expect(result.isClean).toBe(true);
      expect(result.scanProvider).toBe('mock');
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    test('should detect suspicious patterns in file content', async () => {
      process.env.NODE_ENV = 'test';
      const suspiciousContent = '<script>alert("xss")</script>';
      const file = createMockFile({
        name: 'suspicious.pdf',
        type: 'application/pdf',
        content: suspiciousContent,
      });

      const result = await scanFileForViruses(file, { provider: 'mock' });

      expect(result.isClean).toBe(false);
      expect(result.threatName).toContain('SUSPICIOUS_CONTENT');
    });

    test('should fail closed in production when scanner not configured', async () => {
      process.env.NODE_ENV = 'production';
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await scanFileForViruses(file, { provider: 'mock' });

      expect(result.isClean).toBe(false);
      expect(result.threatName).toBe('SCANNER_NOT_CONFIGURED');
    });

    test('should fail closed when ClamAV not configured', async () => {
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await scanFileForViruses(file, { provider: 'clamav' });

      expect(result.isClean).toBe(false);
      expect(result.threatName).toBe('SCANNER_NOT_CONFIGURED');
      expect(result.scanProvider).toBe('clamav');
    });
  });

  describe('validateFile (combined validation)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    test('should combine type validation and virus scan', async () => {
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await validateFile(file, {
        scannerConfig: { provider: 'mock' },
      });

      expect(result.isValid).toBe(true);
      expect(result.typeValidation.isValid).toBe(true);
      expect(result.virusScan).not.toBeNull();
      expect(result.virusScan?.isClean).toBe(true);
    });

    test('should respect skipVirusScan option', async () => {
      const file = createMockFile({
        name: 'document.pdf',
        type: 'application/pdf',
      });

      const result = await validateFile(file, { skipVirusScan: true });

      expect(result.isValid).toBe(true);
      expect(result.virusScan).toBeNull();
    });

    test('should fail if type validation fails', async () => {
      const file = createSpoofedFile({
        name: 'malware.pdf',
        claimedType: 'application/pdf',
        actualContent: 'exe',
      });

      const result = await validateFile(file, { skipVirusScan: true });

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should fail if virus scan detects threat', async () => {
      process.env.NODE_ENV = 'test';
      const suspiciousContent = '<?php system($_GET["cmd"]); ?>';
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      // Combine PDF magic bytes with suspicious content
      const combined = new Uint8Array(pdfBytes.length + suspiciousContent.length);
      combined.set(pdfBytes);
      combined.set(new TextEncoder().encode(suspiciousContent), pdfBytes.length);

      const file = createFileFromBytes(combined, 'malicious.pdf', 'application/pdf');

      const result = await validateFile(file, {
        scannerConfig: { provider: 'mock' },
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Security threat detected');
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    test('should include common document and image types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    });

    test('should include MS Word document types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/msword');
      expect(ALLOWED_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });
  });
});
