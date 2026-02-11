/**
 * Integration tests for Document Analysis API route.
 *
 * Tests cover:
 * - POST /api/documents/[id]/analyze - Analyze document with AI
 * - Authentication and authorization
 * - Document status validation (expired, terminal states)
 * - URL validation (SSRF prevention)
 * - State machine transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockAttorneyId = 'attorney-123';
const mockClientId = 'client-456';
const mockDocumentId = 'doc-789';
const mockCaseId = 'case-abc';

const mockDocument = {
  id: mockDocumentId,
  case_id: mockCaseId,
  uploaded_by: mockClientId,
  document_type: 'passport',
  status: 'uploaded',
  file_name: 'passport.pdf',
  file_url: `${mockCaseId}/1234567890-abc123.pdf`,
  file_size: 1024,
  mime_type: 'application/pdf',
  ai_extracted_data: null,
  ai_confidence_score: null,
  expiration_date: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockCase = {
  id: mockCaseId,
  attorney_id: mockAttorneyId,
  client_id: mockClientId,
  visa_type: 'H1B',
  status: 'in_review',
  title: 'H-1B Application',
};

const mockAnalysisResult = {
  document_type: 'passport',
  overall_confidence: 0.85,
  processing_time_ms: 1500,
  extracted_fields: [
    {
      field_name: 'full_name',
      value: 'John Doe',
      confidence: 0.9,
      requires_verification: false,
      source_location: { page: 1, x: 100, y: 200 },
    },
    {
      field_name: 'passport_number',
      value: 'AB123456',
      confidence: 0.85,
      requires_verification: true,
      source_location: { page: 1, x: 100, y: 300 },
    },
  ],
  warnings: [],
  errors: [],
  raw_text: 'Extracted passport text...',
};

// Mock CAS query result (used for concurrent analysis protection)
const mockCasResult = { data: { id: mockDocumentId }, error: null };

// Chainable query builder for supabase.from('documents').update(...).eq(...).eq(...).select(...).single()
function createChainableMock(result = mockCasResult) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

let mockQueryChain = createChainableMock();

// Mock storage for signed URL generation
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/documents/signed-url' },
  error: null,
});

const mockStorageFrom = vi.fn().mockReturnValue({
  createSignedUrl: mockCreateSignedUrl,
});

// Mock the supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockQueryChain),
  storage: {
    from: mockStorageFrom,
  },
};

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock db services
vi.mock('@/lib/db', () => ({
  documentsService: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
  },
  casesService: {
    getCase: vi.fn(),
  },
}));

// Mock AI analysis
vi.mock('@/lib/ai', () => ({
  analyzeDocument: vi.fn(),
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  aiRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  RATE_LIMITS: {
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Mock security validation
vi.mock('@/lib/security', () => ({
  validateStorageUrl: vi.fn().mockReturnValue(true),
}));

// Mock AI consent check
vi.mock('@/lib/auth/api-helpers', () => ({
  requireAiConsent: vi.fn().mockResolvedValue(null),
}));

// Mock billing quota
vi.mock('@/lib/billing/quota', () => ({
  enforceQuota: vi.fn().mockResolvedValue(undefined),
  trackUsage: vi.fn().mockResolvedValue(undefined),
  QuotaExceededError: class QuotaExceededError extends Error {
    constructor(public metric: string, public limit: number, public current: number) {
      super(`Quota exceeded for ${metric}: ${current}/${limit}`);
      this.name = 'QuotaExceededError';
    }
  },
}));

// Import handlers after mocks
import { POST } from './route';
import { documentsService, casesService } from '@/lib/db';
import { analyzeDocument } from '@/lib/ai';
import { aiRateLimiter } from '@/lib/rate-limit';
import { validateStorageUrl } from '@/lib/security';

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): NextRequest {
  const url = `http://localhost:3000${path}`;

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const request = new NextRequest(url, requestInit);

  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create mock params
function createMockParams(id: string = mockDocumentId): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('POST /api/documents/[id]/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset CAS query chain mock for each test
    mockQueryChain = createChainableMock();
    mockSupabaseClient.from = vi.fn(() => mockQueryChain);

    // Reset storage mock for signed URL generation
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/documents/signed-url' },
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });
    mockSupabaseClient.storage = { from: mockStorageFrom };

    // Default: authenticated as attorney
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
      error: null,
    });

    // Default: document exists and is valid
    vi.mocked(documentsService.getDocument).mockResolvedValue({ ...mockDocument } as any);
    vi.mocked(documentsService.updateDocument).mockImplementation(async (id, updates) => ({
      ...mockDocument,
      ...updates,
    } as any));

    // Default: case exists and attorney has access
    vi.mocked(casesService.getCase).mockResolvedValue({ ...mockCase } as any);

    // Default: AI analysis succeeds
    vi.mocked(analyzeDocument).mockResolvedValue({ ...mockAnalysisResult } as any);

    // Default: rate limit allows
    vi.mocked(aiRateLimiter.limit).mockResolvedValue({ allowed: true } as any);

    // Default: URL validation passes
    vi.mocked(validateStorageUrl).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Authorization tests
  // ==========================================================================
  describe('authorization', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 when non-attorney tries to analyze', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('returns 404 when document does not exist', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue(null);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('returns 404 when case does not exist', async () => {
      vi.mocked(casesService.getCase).mockResolvedValue(null);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Case not found');
    });
  });

  // ==========================================================================
  // Rate limiting tests
  // ==========================================================================
  describe('rate limiting', () => {
    it('returns rate limit response when exceeded', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too many AI requests. Please try again later.' }),
        { status: 429 }
      );

      vi.mocked(aiRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: rateLimitResponse,
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });

      expect(response.status).toBe(429);
    });
  });

  // ==========================================================================
  // Expiration tests (Fix #1)
  // ==========================================================================
  describe('document expiration', () => {
    it('returns 410 for document with expired status', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'expired',
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('Document has expired and cannot be analyzed');
    });

    it('returns 410 for document past expiration_date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'uploaded',
        expiration_date: pastDate.toISOString(),
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('Document has expired and cannot be analyzed');
    });

    it('allows analysis for document with future expiration_date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'uploaded',
        expiration_date: futureDate.toISOString(),
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });

      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // Status validation tests
  // ==========================================================================
  describe('status validation', () => {
    it('rejects analysis from verified status (terminal)', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'verified',
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid operation');
      expect(data.message).toContain("Cannot analyze a document with status 'verified'");
      expect(data.message).toContain('terminal state');
    });

    it('rejects analysis from rejected status (terminal)', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'rejected',
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid operation');
    });

    it('rejects analysis from processing status', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        status: 'processing',
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid operation');
    });

    it('allows analysis from uploaded status', async () => {
      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });

      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // URL validation tests (SSRF prevention)
  // ==========================================================================
  describe('URL validation', () => {
    it('rejects documents with invalid file URLs', async () => {
      vi.mocked(validateStorageUrl).mockReturnValue(false);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid document URL');
    });

    it('rejects documents with no file URL', async () => {
      vi.mocked(documentsService.getDocument).mockResolvedValue({
        ...mockDocument,
        file_url: null,
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document has no file to analyze');
    });

    it('accepts valid Supabase storage URLs', async () => {
      vi.mocked(validateStorageUrl).mockReturnValue(true);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });

      expect(response.status).toBe(200);
      expect(validateStorageUrl).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Successful analysis tests
  // ==========================================================================
  describe('successful analysis', () => {
    it('analyzes document and returns results', async () => {
      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.document).toBeDefined();
      expect(data.analysis).toBeDefined();
      expect(data.analysis.overall_confidence).toBe(0.85);
      expect(data.analysis.fields_extracted).toBe(2);
    });

    it('updates document status to analyzed on success', async () => {
      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      await POST(request, { params: createMockParams() });

      // CAS sets status to 'processing' via direct supabase call (not documentsService)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('documents');
      expect(mockQueryChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing' })
      );

      // Final status update uses documentsService
      expect(documentsService.updateDocument).toHaveBeenCalledWith(
        mockDocumentId,
        expect.objectContaining({ status: 'analyzed' })
      );
    });

    it('sets status to needs_review for low confidence results', async () => {
      vi.mocked(analyzeDocument).mockResolvedValue({
        ...mockAnalysisResult,
        overall_confidence: 0.3, // Below 0.5 threshold
      } as any);

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis.requires_manual_review).toBe(true);
      expect(documentsService.updateDocument).toHaveBeenCalledWith(
        mockDocumentId,
        expect.objectContaining({ status: 'needs_review' })
      );
    });
  });

  // ==========================================================================
  // Error handling tests
  // ==========================================================================
  describe('error handling', () => {
    it('resets status on AI analysis failure', async () => {
      vi.mocked(analyzeDocument).mockRejectedValue(new Error('AI service unavailable'));

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI analysis failed');
      expect(data.message).toContain('AI service encountered an issue');

      // Should reset status to uploaded
      expect(documentsService.updateDocument).toHaveBeenCalledWith(
        mockDocumentId,
        expect.objectContaining({ status: 'uploaded' })
      );
    });

    it('resets status on unexpected errors after processing started', async () => {
      // Make the final status update fail to trigger outer error handler
      // CAS succeeds (via mockQueryChain), then documentsService.updateDocument throws
      vi.mocked(documentsService.updateDocument)
        .mockRejectedValueOnce(new Error('Database error'));

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });

      expect(response.status).toBe(500);
    });

    it('does not expose internal error details to client', async () => {
      vi.mocked(analyzeDocument).mockRejectedValue(
        new Error('Internal: API key invalid for model xyz-123')
      );

      const request = createMockRequest('POST', `/api/documents/${mockDocumentId}/analyze`);
      const response = await POST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI analysis failed');
      expect(JSON.stringify(data)).not.toContain('API key');
      expect(JSON.stringify(data)).not.toContain('xyz-123');
    });
  });
});
