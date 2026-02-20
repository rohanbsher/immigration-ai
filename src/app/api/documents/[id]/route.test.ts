import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDocumentId = 'doc-abc-123';
const mockCaseId = 'case-xyz-789';
const mockAttorneyId = 'attorney-001';
const mockClientId = 'client-002';

const mockDocument = {
  id: mockDocumentId,
  case_id: mockCaseId,
  uploaded_by: mockAttorneyId,
  document_type: 'passport',
  status: 'uploaded',
  scan_status: 'clean',
  file_name: 'passport.pdf',
  file_url: `${mockCaseId}/1234567890-abc123.pdf`,
  file_size: 1024,
  mime_type: 'application/pdf',
  ai_extracted_data: null,
  ai_confidence_score: null,
  verified_by: null,
  verified_at: null,
  expiration_date: null,
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  uploader: { id: mockAttorneyId, first_name: 'Attorney', last_name: 'User' },
};

const mockCase = {
  id: mockCaseId,
  attorney_id: mockAttorneyId,
  client_id: mockClientId,
  visa_type: 'H1B',
  status: 'intake',
  title: 'Test Case',
};

// Mock Supabase client
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://example.com/signed/file.pdf' },
  error: null,
});
const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
const mockStorageFrom = vi.fn().mockReturnValue({
  createSignedUrl: mockCreateSignedUrl,
  remove: mockRemove,
});

const mockFormSelect = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }),
  storage: {
    from: mockStorageFrom,
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// Mock db services
const mockGetDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();
const mockGetCase = vi.fn();

vi.mock('@/lib/db', () => ({
  documentsService: {
    getDocument: (...args: unknown[]) => mockGetDocument(...args),
    updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
    deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  },
  casesService: {
    getCase: (...args: unknown[]) => mockGetCase(...args),
  },
}));

// Mock audit service
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockAuditLogAccess = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logAccess: (...args: unknown[]) => mockAuditLogAccess(...args),
  },
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  aiRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 9, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  authRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 4, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 19, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() }),
    getHeaders: vi.fn().mockReturnValue({}),
  }),
  resetRateLimit: vi.fn(),
  clearAllRateLimits: vi.fn(),
  isRedisRateLimitingEnabled: vi.fn().mockReturnValue(false),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Mock storage constants
vi.mock('@/lib/storage', () => ({
  SIGNED_URL_EXPIRATION: {
    AI_PROCESSING: 600,
    USER_DOWNLOAD: 300,
    PREVIEW: 900,
  },
}));

// Mock validation
vi.mock('@/lib/validation', () => ({
  DOCUMENT_TYPES: [
    'passport', 'visa', 'i94', 'birth_certificate', 'marriage_certificate',
    'divorce_certificate', 'employment_letter', 'pay_stub', 'tax_return',
    'w2', 'bank_statement', 'photo', 'medical_exam', 'police_clearance',
    'diploma', 'transcript', 'recommendation_letter', 'other',
  ],
  DOCUMENT_STATUSES: [
    'uploaded', 'processing', 'analyzed', 'needs_review',
    'verified', 'rejected', 'expired',
  ],
}));

// Mock safeParseBody
vi.mock('@/lib/auth/api-helpers', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextResponse } = require('next/server');
  return {
    safeParseBody: async (request: NextRequest) => {
      try {
        const data = await request.json();
        return { success: true, data };
      } catch {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          ),
        };
      }
    },
  };
});

// Import route handlers AFTER mocks
import { GET, PATCH, DELETE } from './route';
import { sensitiveRateLimiter } from '@/lib/rate-limit';

const mockedSensitiveRateLimiter = vi.mocked(sensitiveRateLimiter);

function createMockRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const url = `http://localhost:3000/api/documents/${mockDocumentId}`;
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
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

function createMockParams(id: string = mockDocumentId): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('Documents [id] API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
      error: null,
    });

    // Default: rate limiter allows requests
    mockedSensitiveRateLimiter.limit.mockResolvedValue({ allowed: true } as { allowed: true });

    // Default: document and case found with attorney access
    mockGetDocument.mockResolvedValue(mockDocument);
    mockGetCase.mockResolvedValue(mockCase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // GET /api/documents/[id]
  // ========================================================================
  describe('GET /api/documents/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when document does not exist', async () => {
      mockGetDocument.mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 404 when case does not exist', async () => {
      mockGetCase.mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 404 when user has no access to the case', async () => {
      mockGetCase.mockResolvedValue({
        ...mockCase,
        attorney_id: 'other-attorney',
        client_id: 'other-client',
      });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 403 when document has degraded scan status', async () => {
      mockGetDocument.mockResolvedValue({
        ...mockDocument,
        scan_status: 'degraded',
      });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('pending security scan');
    });

    it('should return 200 with document and signed URL for attorney', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockDocumentId);
      expect(data.file_url).toBe('https://example.com/signed/file.pdf');
    });

    it('should return 200 with document for client', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockDocumentId);
    });

    it('should log document access for audit', async () => {
      const request = createMockRequest('GET');
      await GET(request, { params: createMockParams() });

      expect(mockAuditLogAccess).toHaveBeenCalledWith(
        'documents',
        mockDocumentId,
        expect.objectContaining({
          additional_context: expect.objectContaining({
            document_type: 'passport',
            case_id: mockCaseId,
          }),
        })
      );
    });

    it('should return 429 when rate limited', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too Many Requests' }),
        { status: 429 }
      );
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: rateLimitResponse,
      } as { allowed: false; response: Response });

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });

      expect(response.status).toBe(429);
    });
  });

  // ========================================================================
  // PATCH /api/documents/[id]
  // ========================================================================
  describe('PATCH /api/documents/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('PATCH', { status: 'verified' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when document not accessible', async () => {
      mockGetDocument.mockResolvedValue(null);

      const request = createMockRequest('PATCH', { status: 'verified' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 403 when client tries to modify document', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      const request = createMockRequest('PATCH', { status: 'verified' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid Zod data', async () => {
      const request = createMockRequest('PATCH', { document_type: 'invalid_type' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 200 when attorney updates document', async () => {
      const updatedDoc = { ...mockDocument, status: 'verified' };
      mockUpdateDocument.mockResolvedValue(updatedDoc);

      const request = createMockRequest('PATCH', { status: 'verified' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('verified');
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        mockDocumentId,
        { status: 'verified' }
      );
    });
  });

  // ========================================================================
  // DELETE /api/documents/[id]
  // ========================================================================
  describe('DELETE /api/documents/[id]', () => {
    beforeEach(() => {
      // Setup the forms query chain for delete handler
      const mockFormQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
      mockSupabaseClient.from.mockReturnValue(mockFormQueryChain);
      // No affected forms by default
      mockFormQueryChain.not.mockResolvedValue({ data: [], error: null });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when document not accessible', async () => {
      mockGetDocument.mockResolvedValue(null);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 403 when non-uploader client tries to delete', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });
      // Client is not the uploader (attorney uploaded), and is not attorney
      mockGetDocument.mockResolvedValue({
        ...mockDocument,
        uploaded_by: mockAttorneyId,
      });

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 200 when attorney deletes document', async () => {
      mockDeleteDocument.mockResolvedValue(undefined);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Document deleted successfully');
      expect(mockDeleteDocument).toHaveBeenCalledWith(mockDocumentId);
    });

    it('should remove file from storage on delete', async () => {
      mockDeleteDocument.mockResolvedValue(undefined);

      const request = createMockRequest('DELETE');
      await DELETE(request, { params: createMockParams() });

      expect(mockStorageFrom).toHaveBeenCalledWith('documents');
      expect(mockRemove).toHaveBeenCalledWith([mockDocument.file_url]);
    });

    it('should handle database error gracefully', async () => {
      mockGetDocument.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete document');
    });
  });

  // ========================================================================
  // Error handling
  // ========================================================================
  describe('Error handling', () => {
    it('should handle GET database errors gracefully', async () => {
      mockGetDocument.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch document');
    });

    it('should handle PATCH database errors gracefully', async () => {
      mockUpdateDocument.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('PATCH', { status: 'verified' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update document');
    });
  });
});
