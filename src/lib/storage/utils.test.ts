import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFilePath,
  getFileExtension,
  isAllowedFileType,
  formatFileSize,
} from './utils';

describe('Storage Utils', () => {
  describe('generateFilePath', () => {
    let originalDateNow: () => number;

    beforeEach(() => {
      originalDateNow = Date.now;
      Date.now = vi.fn(() => 1700000000000);
      vi.stubGlobal('crypto', {
        ...crypto,
        randomUUID: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
      });
    });

    afterEach(() => {
      Date.now = originalDateNow;
      vi.unstubAllGlobals();
    });

    it('should generate path with caseId, timestamp, random string, and sanitized name', () => {
      const result = generateFilePath('case-123', 'document.pdf');

      expect(result).toMatch(/^case-123\/1700000000000-/);
      expect(result).toContain('-document.pdf');
    });

    it('should sanitize special characters in filename', () => {
      const result = generateFilePath('case-123', 'my document (1).pdf');

      expect(result).toMatch(/my_document__1_\.pdf$/);
    });

    it('should handle filenames with multiple dots', () => {
      const result = generateFilePath('case-123', 'file.name.with.dots.pdf');

      expect(result).toMatch(/file_name_with_dots\.pdf$/);
    });

    it('should truncate long filenames to 50 characters', () => {
      const longName = 'a'.repeat(100) + '.pdf';
      const result = generateFilePath('case-123', longName);

      const sanitizedPart = result.split('-').pop()?.replace('.pdf', '');
      expect(sanitizedPart?.length).toBeLessThanOrEqual(50);
    });

    it('should preserve file extension', () => {
      expect(generateFilePath('case-1', 'test.pdf')).toMatch(/\.pdf$/);
      expect(generateFilePath('case-1', 'test.docx')).toMatch(/\.docx$/);
      expect(generateFilePath('case-1', 'test.PNG')).toMatch(/\.PNG$/);
    });

    it('should handle empty filename before extension', () => {
      const result = generateFilePath('case-123', '.pdf');

      expect(result).toContain('.pdf');
    });
  });

  describe('getFileExtension', () => {
    it('should return lowercase extension for standard files', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.PNG')).toBe('png');
      expect(getFileExtension('file.DOCX')).toBe('docx');
    });

    it('should return extension for files with multiple dots', () => {
      expect(getFileExtension('file.name.with.dots.pdf')).toBe('pdf');
    });

    it('should return the filename itself when no dot exists', () => {
      expect(getFileExtension('filename')).toBe('filename');
    });

    it('should handle hidden files (starting with dot)', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
    });

    it('should handle empty string', () => {
      expect(getFileExtension('')).toBe('');
    });
  });

  describe('isAllowedFileType', () => {
    it('should allow PDF files', () => {
      expect(isAllowedFileType('application/pdf')).toBe(true);
    });

    it('should allow common image types', () => {
      expect(isAllowedFileType('image/jpeg')).toBe(true);
      expect(isAllowedFileType('image/png')).toBe(true);
      expect(isAllowedFileType('image/gif')).toBe(true);
      expect(isAllowedFileType('image/webp')).toBe(true);
    });

    it('should allow Word documents', () => {
      expect(isAllowedFileType('application/msword')).toBe(true);
      expect(
        isAllowedFileType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe(true);
    });

    it('should reject disallowed file types', () => {
      expect(isAllowedFileType('application/javascript')).toBe(false);
      expect(isAllowedFileType('text/html')).toBe(false);
      expect(isAllowedFileType('application/x-executable')).toBe(false);
      expect(isAllowedFileType('video/mp4')).toBe(false);
    });

    it('should reject empty or invalid MIME types', () => {
      expect(isAllowedFileType('')).toBe(false);
      expect(isAllowedFileType('invalid')).toBe(false);
    });

    it('should be case-sensitive for MIME types', () => {
      expect(isAllowedFileType('APPLICATION/PDF')).toBe(false);
      expect(isAllowedFileType('Image/JPEG')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(10240)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(2147483648)).toBe('2 GB');
    });

    it('should round to one decimal place', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1126)).toBe('1.1 KB');
    });
  });
});
