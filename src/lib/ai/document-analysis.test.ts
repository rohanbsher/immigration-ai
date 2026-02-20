import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup environment before mocks
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------
const {
  openaiMockState,
  claudeMockState,
  storageMock,
  featuresMock,
} = vi.hoisted(() => {
  const openaiMockState = { completionsCreate: vi.fn() };
  const claudeMockState = { messagesCreate: vi.fn() };
  const storageMock = { getSignedUrl: vi.fn() };
  const featuresMock = { documentAnalysisProvider: 'openai' as 'openai' | 'claude' | 'auto' };
  return { openaiMockState, claudeMockState, storageMock, featuresMock };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

vi.mock('@/lib/config', () => ({
  features: featuresMock,
  env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' },
  serverEnv: { OPENAI_API_KEY: 'test-key', ANTHROPIC_API_KEY: 'test-key' },
}));

vi.mock('@/lib/storage', () => ({
  storage: storageMock,
}));

vi.mock('./openai', () => ({
  analyzeDocumentWithVision: vi.fn(),
  detectDocumentType: vi.fn(),
  validateDocumentImage: vi.fn(),
  extractTextFromImage: vi.fn(),
}));

vi.mock('./claude-vision', () => ({
  analyzeDocumentWithClaude: vi.fn(),
  extractTextWithClaude: vi.fn(),
  detectDocumentTypeWithClaude: vi.fn(),
  validateDocumentImageWithClaude: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  analyzeDocument,
  analyzeDocuments,
  extractSpecificFields,
  getDocumentText,
  compareDocuments,
  validateDocumentForVisa,
} from './document-analysis';
import {
  analyzeDocumentWithVision,
  detectDocumentType,
  validateDocumentImage,
  extractTextFromImage,
} from './openai';
import {
  analyzeDocumentWithClaude,
  extractTextWithClaude,
  detectDocumentTypeWithClaude,
  validateDocumentImageWithClaude,
} from './claude-vision';
import type { DocumentAnalysisResult } from './types';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockAnalyzeVision = vi.mocked(analyzeDocumentWithVision);
const mockDetectType = vi.mocked(detectDocumentType);
const mockValidateImage = vi.mocked(validateDocumentImage);
const mockExtractText = vi.mocked(extractTextFromImage);
const mockAnalyzeClaude = vi.mocked(analyzeDocumentWithClaude);
const mockExtractTextClaude = vi.mocked(extractTextWithClaude);
const mockDetectTypeClaude = vi.mocked(detectDocumentTypeWithClaude);
const mockValidateImageClaude = vi.mocked(validateDocumentImageWithClaude);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockAnalysisResult: DocumentAnalysisResult = {
  document_type: 'passport',
  extracted_fields: [
    { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
    { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
    { field_name: 'passport_number', value: 'AB1234567', confidence: 0.98, requires_verification: false },
    { field_name: 'expiry_date', value: '2030-06-15', confidence: 0.95, requires_verification: false },
    { field_name: 'nationality', value: 'United States', confidence: 0.90, requires_verification: false },
  ],
  overall_confidence: 0.94,
  processing_time_ms: 1500,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.documentAnalysisProvider = 'openai';
  });

  describe('with fileUrl', () => {
    it('analyzes a document successfully with all stages', async () => {
      mockValidateImage.mockResolvedValue({ isValid: true, suggestedType: 'passport' });
      mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.95 });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      const progressStages: string[] = [];
      const result = await analyzeDocument(
        { documentId: 'doc-1', fileUrl: 'https://example.com/passport.jpg' },
        (p) => progressStages.push(p.stage)
      );

      expect(result.document_type).toBe('passport');
      expect(result.extracted_fields).toHaveLength(5);
      expect(result.overall_confidence).toBe(0.94);
      expect(progressStages).toContain('validating');
      expect(progressStages).toContain('detecting_type');
      expect(progressStages).toContain('extracting');
      expect(progressStages).toContain('complete');
    });

    it('skips type detection when documentType is provided', async () => {
      mockValidateImage.mockResolvedValue({ isValid: true });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/passport.jpg',
        documentType: 'passport',
      });

      expect(mockDetectType).not.toHaveBeenCalled();
    });

    it('skips type detection when document_type is in options', async () => {
      mockValidateImage.mockResolvedValue({ isValid: true });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/passport.jpg',
        options: { document_type: 'passport' },
      });

      expect(mockDetectType).not.toHaveBeenCalled();
    });

    it('returns invalid result when validation fails', async () => {
      mockValidateImage.mockResolvedValue({ isValid: false, reason: 'Image is blurry' });

      const result = await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/blurry.jpg',
      });

      expect(result.document_type).toBe('invalid');
      expect(result.overall_confidence).toBe(0);
      expect(result.errors).toContain('Image is blurry');
      expect(mockDetectType).not.toHaveBeenCalled();
      expect(mockAnalyzeVision).not.toHaveBeenCalled();
    });

    it('returns default error message when validation fails without reason', async () => {
      mockValidateImage.mockResolvedValue({ isValid: false });

      const result = await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/invalid.jpg',
      });

      expect(result.errors).toContain('Invalid document image');
    });
  });

  describe('with filePath and bucket (signed URL)', () => {
    it('generates a signed URL and analyzes', async () => {
      storageMock.getSignedUrl.mockResolvedValue('https://example.com/signed-url');
      mockValidateImage.mockResolvedValue({ isValid: true });
      mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      const result = await analyzeDocument({
        documentId: 'doc-1',
        filePath: 'cases/doc.jpg',
        bucket: 'documents',
      });

      expect(storageMock.getSignedUrl).toHaveBeenCalledWith('documents', 'cases/doc.jpg', 600);
      expect(result.document_type).toBe('passport');
    });
  });

  describe('error handling', () => {
    it('throws when no URL is available', async () => {
      await expect(
        analyzeDocument({ documentId: 'doc-1' })
      ).rejects.toThrow('No document URL available for analysis');
    });

    it('reports error progress when analysis throws', async () => {
      mockValidateImage.mockRejectedValue(new Error('Network error'));

      const progressStages: string[] = [];
      await expect(
        analyzeDocument(
          { documentId: 'doc-1', fileUrl: 'https://example.com/doc.jpg' },
          (p) => progressStages.push(p.stage)
        )
      ).rejects.toThrow('Network error');

      expect(progressStages).toContain('error');
    });

    it('works without progress callback', async () => {
      mockValidateImage.mockResolvedValue({ isValid: true });
      mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      const result = await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/doc.jpg',
      });

      expect(result.document_type).toBe('passport');
    });
  });

  describe('provider routing', () => {
    it('uses OpenAI when provider is openai', async () => {
      featuresMock.documentAnalysisProvider = 'openai';
      mockValidateImage.mockResolvedValue({ isValid: true });
      mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/doc.jpg',
      });

      expect(mockValidateImage).toHaveBeenCalled();
      expect(mockValidateImageClaude).not.toHaveBeenCalled();
    });

    it('uses Claude when provider is claude', async () => {
      featuresMock.documentAnalysisProvider = 'claude';
      mockValidateImageClaude.mockResolvedValue({ isValid: true });
      mockDetectTypeClaude.mockResolvedValue({ type: 'passport', confidence: 0.9 });
      mockAnalyzeClaude.mockResolvedValue(mockAnalysisResult);

      await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/doc.jpg',
      });

      expect(mockValidateImageClaude).toHaveBeenCalled();
      expect(mockValidateImage).not.toHaveBeenCalled();
    });

    it('falls back to OpenAI when Claude fails in auto mode', async () => {
      featuresMock.documentAnalysisProvider = 'auto';
      // Validation: Claude fails, OpenAI succeeds
      mockValidateImageClaude.mockRejectedValue(new Error('Claude down'));
      mockValidateImage.mockResolvedValue({ isValid: true });
      // Detection: Claude fails, OpenAI succeeds
      mockDetectTypeClaude.mockRejectedValue(new Error('Claude down'));
      mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
      // Analysis: Claude fails, OpenAI succeeds
      mockAnalyzeClaude.mockRejectedValue(new Error('Claude down'));
      mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

      const result = await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/doc.jpg',
      });

      expect(result.document_type).toBe('passport');
      expect(mockValidateImageClaude).toHaveBeenCalled();
      expect(mockValidateImage).toHaveBeenCalled();
    });

    it('uses Claude successfully in auto mode without fallback', async () => {
      featuresMock.documentAnalysisProvider = 'auto';
      mockValidateImageClaude.mockResolvedValue({ isValid: true });
      mockDetectTypeClaude.mockResolvedValue({ type: 'passport', confidence: 0.95 });
      mockAnalyzeClaude.mockResolvedValue(mockAnalysisResult);

      const result = await analyzeDocument({
        documentId: 'doc-1',
        fileUrl: 'https://example.com/doc.jpg',
      });

      expect(result.document_type).toBe('passport');
      expect(mockValidateImageClaude).toHaveBeenCalled();
      expect(mockValidateImage).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// analyzeDocuments (batch)
// ---------------------------------------------------------------------------

describe('analyzeDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.documentAnalysisProvider = 'openai';
  });

  it('analyzes multiple documents and returns a Map', async () => {
    mockValidateImage.mockResolvedValue({ isValid: true });
    mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
    mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

    const results = await analyzeDocuments([
      { documentId: 'doc-1', fileUrl: 'https://example.com/doc1.jpg' },
      { documentId: 'doc-2', fileUrl: 'https://example.com/doc2.jpg' },
    ]);

    expect(results).toBeInstanceOf(Map);
    expect(results.size).toBe(2);
    expect(results.get('doc-1')?.document_type).toBe('passport');
    expect(results.get('doc-2')?.document_type).toBe('passport');
  });

  it('handles individual failures gracefully', async () => {
    // First doc succeeds, second fails
    mockValidateImage
      .mockResolvedValueOnce({ isValid: true })
      .mockRejectedValueOnce(new Error('fail'));
    mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
    mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

    const results = await analyzeDocuments([
      { documentId: 'doc-1', fileUrl: 'https://example.com/doc1.jpg' },
      { documentId: 'doc-2', fileUrl: 'https://example.com/doc2.jpg' },
    ]);

    expect(results.size).toBe(2);
    expect(results.get('doc-1')?.document_type).toBe('passport');
    expect(results.get('doc-2')?.document_type).toBe('error');
    expect(results.get('doc-2')?.errors).toBeDefined();
  });

  it('reports progress per document', async () => {
    mockValidateImage.mockResolvedValue({ isValid: true });
    mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
    mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

    const progressCalls: Array<{ docId: string; stage: string }> = [];

    await analyzeDocuments(
      [
        { documentId: 'doc-1', fileUrl: 'https://example.com/doc1.jpg' },
        { documentId: 'doc-2', fileUrl: 'https://example.com/doc2.jpg' },
      ],
      (docId, progress) => {
        progressCalls.push({ docId, stage: progress.stage });
      }
    );

    expect(progressCalls.some((c) => c.docId === 'doc-1')).toBe(true);
    expect(progressCalls.some((c) => c.docId === 'doc-2')).toBe(true);
  });

  it('respects concurrency limit of 3', async () => {
    mockValidateImage.mockResolvedValue({ isValid: true });
    mockDetectType.mockResolvedValue({ type: 'passport', confidence: 0.9 });
    mockAnalyzeVision.mockResolvedValue(mockAnalysisResult);

    const docs = Array.from({ length: 7 }, (_, i) => ({
      documentId: `doc-${i}`,
      fileUrl: `https://example.com/doc${i}.jpg`,
    }));

    const results = await analyzeDocuments(docs);
    expect(results.size).toBe(7);
  });

  it('handles empty documents array', async () => {
    const results = await analyzeDocuments([]);
    expect(results.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractSpecificFields
// ---------------------------------------------------------------------------

describe('extractSpecificFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.documentAnalysisProvider = 'openai';
  });

  it('returns only requested fields', async () => {
    mockAnalyzeVision.mockResolvedValue({
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
        { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.92, requires_verification: false },
        { field_name: 'passport_number', value: 'AB123', confidence: 0.98, requires_verification: false },
      ],
    });

    const result = await extractSpecificFields(
      'https://example.com/doc.jpg',
      ['full_name', 'passport_number']
    );

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.field_name)).toEqual(['full_name', 'passport_number']);
  });

  it('returns empty array when no matching fields', async () => {
    mockAnalyzeVision.mockResolvedValue({
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: 'John', confidence: 0.9, requires_verification: false },
      ],
    });

    const result = await extractSpecificFields(
      'https://example.com/doc.jpg',
      ['nonexistent_field']
    );

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDocumentText
// ---------------------------------------------------------------------------

describe('getDocumentText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.documentAnalysisProvider = 'openai';
  });

  it('returns extracted text from document', async () => {
    mockExtractText.mockResolvedValue({
      text: 'This is the document text content.',
      confidence: 0.9,
    });

    const text = await getDocumentText('https://example.com/doc.jpg');
    expect(text).toBe('This is the document text content.');
  });

  it('returns empty string when no text extracted', async () => {
    mockExtractText.mockResolvedValue({ text: '', confidence: 0 });

    const text = await getDocumentText('https://example.com/blank.jpg');
    expect(text).toBe('');
  });

  it('uses Claude for text extraction when provider is claude', async () => {
    featuresMock.documentAnalysisProvider = 'claude';
    mockExtractTextClaude.mockResolvedValue({
      text: 'Text from Claude',
      confidence: 0.95,
    });

    const text = await getDocumentText('https://example.com/doc.jpg');
    expect(text).toBe('Text from Claude');
    expect(mockExtractTextClaude).toHaveBeenCalled();
    expect(mockExtractText).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// compareDocuments
// ---------------------------------------------------------------------------

describe('compareDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.documentAnalysisProvider = 'openai';
  });

  it('identifies identical documents', async () => {
    const sameResult: DocumentAnalysisResult = {
      document_type: 'passport',
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
      ],
      overall_confidence: 0.95,
      processing_time_ms: 1000,
    };

    mockAnalyzeVision.mockResolvedValueOnce(sameResult);
    mockAnalyzeVision.mockResolvedValueOnce(sameResult);

    const result = await compareDocuments(
      'https://example.com/doc1.jpg',
      'https://example.com/doc2.jpg'
    );

    expect(result.isSameDocument).toBe(true);
    expect(result.similarityScore).toBe(1);
    expect(result.differences).toHaveLength(0);
  });

  it('identifies different document types', async () => {
    mockAnalyzeVision
      .mockResolvedValueOnce({ ...mockAnalysisResult, document_type: 'passport' })
      .mockResolvedValueOnce({ ...mockAnalysisResult, document_type: 'birth_certificate' });

    const result = await compareDocuments(
      'https://example.com/passport.jpg',
      'https://example.com/birth_cert.jpg'
    );

    expect(result.isSameDocument).toBe(false);
    expect(result.similarityScore).toBe(0);
    expect(result.differences[0]).toContain('Different document types');
  });

  it('identifies field value differences', async () => {
    mockAnalyzeVision
      .mockResolvedValueOnce({
        ...mockAnalysisResult,
        extracted_fields: [
          { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.9, requires_verification: false },
        ],
      })
      .mockResolvedValueOnce({
        ...mockAnalysisResult,
        extracted_fields: [
          { field_name: 'full_name', value: 'Jane Doe', confidence: 0.95, requires_verification: false },
          { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.9, requires_verification: false },
        ],
      });

    const result = await compareDocuments(
      'https://example.com/doc1.jpg',
      'https://example.com/doc2.jpg'
    );

    expect(result.isSameDocument).toBe(false);
    expect(result.similarityScore).toBe(0.5);
    expect(result.differences.some((d) => d.includes('full_name'))).toBe(true);
  });

  it('detects missing fields in second document', async () => {
    mockAnalyzeVision
      .mockResolvedValueOnce({
        ...mockAnalysisResult,
        extracted_fields: [
          { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
          { field_name: 'passport_number', value: 'AB123', confidence: 0.9, requires_verification: false },
        ],
      })
      .mockResolvedValueOnce({
        ...mockAnalysisResult,
        extracted_fields: [
          { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
        ],
      });

    const result = await compareDocuments(
      'https://example.com/doc1.jpg',
      'https://example.com/doc2.jpg'
    );

    expect(result.differences.some((d) => d.includes('passport_number') && d.includes('missing'))).toBe(true);
  });

  it('handles both documents with empty fields', async () => {
    mockAnalyzeVision
      .mockResolvedValueOnce({ ...mockAnalysisResult, extracted_fields: [] })
      .mockResolvedValueOnce({ ...mockAnalysisResult, extracted_fields: [] });

    const result = await compareDocuments(
      'https://example.com/doc1.jpg',
      'https://example.com/doc2.jpg'
    );

    // 0 / 0 = 0 similarity, no differences
    expect(result.similarityScore).toBe(0);
    expect(result.differences).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateDocumentForVisa
// ---------------------------------------------------------------------------

describe('validateDocumentForVisa', () => {
  it('accepts valid passport with all required fields', async () => {
    const result = await validateDocumentForVisa(mockAnalysisResult, 'H-1B');
    expect(result.isAcceptable).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('flags low overall confidence', async () => {
    const lowConfidence: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      overall_confidence: 0.5,
    };

    const result = await validateDocumentForVisa(lowConfidence, 'H-1B');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.some((i) => i.includes('quality'))).toBe(true);
  });

  it('flags missing required fields for passport', async () => {
    const missingFields: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
      ],
    };

    const result = await validateDocumentForVisa(missingFields, 'H-1B');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.some((i) => i.includes('date_of_birth'))).toBe(true);
    expect(result.issues.some((i) => i.includes('passport_number'))).toBe(true);
    expect(result.issues.some((i) => i.includes('expiry_date'))).toBe(true);
    expect(result.issues.some((i) => i.includes('nationality'))).toBe(true);
  });

  it('flags null field values as missing', async () => {
    const nullFields: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: null, confidence: 0, requires_verification: true },
        { field_name: 'date_of_birth', value: null, confidence: 0, requires_verification: true },
        { field_name: 'passport_number', value: null, confidence: 0, requires_verification: true },
        { field_name: 'expiry_date', value: null, confidence: 0, requires_verification: true },
        { field_name: 'nationality', value: null, confidence: 0, requires_verification: true },
      ],
      overall_confidence: 0.3,
    };

    const result = await validateDocumentForVisa(nullFields, 'H-1B');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('suggests review for low-confidence fields', async () => {
    const lowFieldConfidence: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.6, requires_verification: true },
        { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.95, requires_verification: false },
        { field_name: 'passport_number', value: 'AB123', confidence: 0.95, requires_verification: false },
        { field_name: 'expiry_date', value: '2030-01-15', confidence: 0.95, requires_verification: false },
        { field_name: 'nationality', value: 'United States', confidence: 0.95, requires_verification: false },
      ],
    };

    const result = await validateDocumentForVisa(lowFieldConfidence, 'H-1B');
    expect(result.suggestions.some((s) => s.includes('full_name') && s.includes('60%'))).toBe(true);
  });

  it('flags passport expiring within 6 months', async () => {
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 3);
    const expiryString = soon.toISOString().split('T')[0];

    const expiring: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
        { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.95, requires_verification: false },
        { field_name: 'passport_number', value: 'AB123', confidence: 0.95, requires_verification: false },
        { field_name: 'expiry_date', value: expiryString, confidence: 0.95, requires_verification: false },
        { field_name: 'nationality', value: 'United States', confidence: 0.95, requires_verification: false },
      ],
    };

    const result = await validateDocumentForVisa(expiring, 'H-1B');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.some((i) => i.includes('expires within 6 months'))).toBe(true);
  });

  it('does not flag passport expiry check for non-passport documents', async () => {
    const birthCert: DocumentAnalysisResult = {
      document_type: 'birth_certificate',
      extracted_fields: [
        { field_name: 'full_name', value: 'John Doe', confidence: 0.95, requires_verification: false },
        { field_name: 'date_of_birth', value: '1990-01-15', confidence: 0.95, requires_verification: false },
        { field_name: 'place_of_birth', value: 'New York', confidence: 0.90, requires_verification: false },
      ],
      overall_confidence: 0.93,
      processing_time_ms: 1000,
    };

    const result = await validateDocumentForVisa(birthCert, 'H-1B');
    expect(result.isAcceptable).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('validates marriage certificate required fields', async () => {
    const marriageCert: DocumentAnalysisResult = {
      document_type: 'marriage_certificate',
      extracted_fields: [
        { field_name: 'spouse_1_name', value: 'John', confidence: 0.9, requires_verification: false },
        // Missing spouse_2_name and date_of_marriage
      ],
      overall_confidence: 0.85,
      processing_time_ms: 800,
    };

    const result = await validateDocumentForVisa(marriageCert, 'I-130');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.some((i) => i.includes('spouse_2_name'))).toBe(true);
    expect(result.issues.some((i) => i.includes('date_of_marriage'))).toBe(true);
  });

  it('validates employment letter required fields', async () => {
    const empLetter: DocumentAnalysisResult = {
      document_type: 'employment_letter',
      extracted_fields: [],
      overall_confidence: 0.85,
      processing_time_ms: 800,
    };

    const result = await validateDocumentForVisa(empLetter, 'H-1B');
    expect(result.isAcceptable).toBe(false);
    expect(result.issues.some((i) => i.includes('employee_name'))).toBe(true);
    expect(result.issues.some((i) => i.includes('employer_name'))).toBe(true);
    expect(result.issues.some((i) => i.includes('job_title'))).toBe(true);
  });

  it('includes analysis warnings in suggestions', async () => {
    const withWarnings: DocumentAnalysisResult = {
      ...mockAnalysisResult,
      warnings: ['Slight blur detected', 'Low resolution image'],
    };

    const result = await validateDocumentForVisa(withWarnings, 'H-1B');
    expect(result.suggestions).toContain('Slight blur detected');
    expect(result.suggestions).toContain('Low resolution image');
  });

  it('handles unknown document type gracefully (no required fields)', async () => {
    const unknown: DocumentAnalysisResult = {
      document_type: 'some_unknown_type',
      extracted_fields: [],
      overall_confidence: 0.85,
      processing_time_ms: 500,
    };

    const result = await validateDocumentForVisa(unknown, 'H-1B');
    expect(result.isAcceptable).toBe(true);
  });
});
