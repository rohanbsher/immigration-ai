import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockFormId = 'form-pdf-123';
const mockCaseId = 'case-pdf-789';
const mockAttorneyId = 'attorney-pdf-001';
const mockClientId = 'client-pdf-002';

const mockForm = {
  id: mockFormId,
  case_id: mockCaseId,
  form_type: 'I-130',
  status: 'approved',
  form_data: { first_name: 'John', last_name: 'Doe' },
  ai_filled_data: { date_of_birth: '1990-01-15' },
  ai_confidence_scores: { first_name: 0.95, last_name: 0.95, date_of_birth: 0.9 },
  review_notes: null,
  reviewed_by: mockAttorneyId,
  reviewed_at: '2024-01-10T00:00:00Z',
  filed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-10T00:00:00Z',
};

// Mock function references
const mockGetForm = vi.fn();
const mockVerifyFormAccess = vi.fn();
const mockGenerateFormPDF = vi.fn();
const mockIsPDFGenerationSupported = vi.fn();
const mockAuditLog = vi.fn().mockResolvedValue(undefined);

// Shared auth state for withAuth mock
let mockAuthUser: { id: string; email: string } | null = null;
let mockAuthProfile: Record<string, unknown> | null = null;

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// Mock db services
vi.mock('@/lib/db', () => ({
  formsService: {
    getForm: (...args: unknown[]) => mockGetForm(...args),
  },
}));

// Mock auth helpers with withAuth
vi.mock('@/lib/auth/api-helpers', () => {
  const errorResponseFn = (error: string, status: number) =>
    NextResponse.json({ success: false, error }, { status });

  const withAuth = (handler: (...args: unknown[]) => unknown) => {
    return async (request: NextRequest, context: Record<string, unknown>) => {
      if (!mockAuthUser) {
        return errorResponseFn('Unauthorized', 401);
      }

      const auth = {
        success: true as const,
        user: mockAuthUser,
        profile: mockAuthProfile,
      };

      try {
        return await handler(request, context, auth);
      } catch {
        return errorResponseFn('Internal server error', 500);
      }
    };
  };

  return {
    withAuth,
    errorResponse: errorResponseFn,
    verifyFormAccess: (...args: unknown[]) => mockVerifyFormAccess(...args),
  };
});

// Mock PDF generation
vi.mock('@/lib/pdf', () => ({
  generateFormPDF: (...args: unknown[]) => mockGenerateFormPDF(...args),
  isPDFGenerationSupported: (...args: unknown[]) => mockIsPDFGenerationSupported(...args),
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logAccess: vi.fn().mockResolvedValue(undefined),
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

// Import route handler after mocks
import { GET } from './route';

function createMockRequest(query?: string): NextRequest {
  const qs = query ? `?${query}` : '';
  return new NextRequest(
    `http://localhost:3000/api/forms/${mockFormId}/pdf${qs}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
    }
  );
}

function createMockContext(id: string = mockFormId) {
  return { params: Promise.resolve({ id }) };
}

describe('Forms [id] PDF API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockAuthUser = { id: mockAttorneyId, email: 'attorney@example.com' };
    mockAuthProfile = { id: mockAttorneyId, email: 'attorney@example.com', role: 'attorney' };

    // Default: form found
    mockGetForm.mockResolvedValue(mockForm);

    // Default: form access granted (attorney)
    mockVerifyFormAccess.mockResolvedValue({
      success: true,
      form: { id: mockFormId, case_id: mockCaseId },
      caseData: { id: mockCaseId, attorney_id: mockAttorneyId, client_id: mockClientId, firm_id: null },
      access: {
        canView: true,
        canModify: true,
        canDelete: true,
        isOwner: true,
        isAttorney: true,
        isClient: false,
      },
    });

    // Default: PDF generation supported
    mockIsPDFGenerationSupported.mockReturnValue(true);

    // Default: PDF generation success
    mockGenerateFormPDF.mockResolvedValue({
      success: true,
      pdfBytes: new Uint8Array([80, 68, 70]),
      fileName: 'I-130_form.pdf',
      isAcroFormFilled: true,
      filledFieldCount: 10,
      totalFieldCount: 15,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthUser = null;

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when form not found', async () => {
    mockGetForm.mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Form not found');
  });

  it('should return error when access denied', async () => {
    mockVerifyFormAccess.mockResolvedValue({
      success: false,
      error: 'Access denied',
      status: 403,
    });

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied');
  });

  it('should return 400 for unsupported form type', async () => {
    mockGetForm.mockResolvedValue({ ...mockForm, form_type: 'I-999' });
    mockIsPDFGenerationSupported.mockReturnValue(false);

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('not yet supported');
  });

  it('should return 500 when PDF generation fails', async () => {
    mockGenerateFormPDF.mockResolvedValue({
      success: false,
      error: 'Template not found',
    });

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Template not found');
  });

  it('should return 200 with PDF for attorney', async () => {
    const request = createMockRequest();
    const response = await GET(request, createMockContext());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('I-130_form.pdf');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    expect(response.headers.get('X-PDF-Type')).toBe('filing-ready');
  });

  it('should include fill stats in response headers', async () => {
    const request = createMockRequest();
    const response = await GET(request, createMockContext());

    const fillStats = response.headers.get('X-Fill-Stats');
    expect(fillStats).toBeTruthy();
    const parsed = JSON.parse(fillStats!);
    expect(parsed.filled).toBe(10);
    expect(parsed.total).toBe(15);
    expect(parsed.formType).toBe('I-130');
  });

  it('should set X-PDF-Type to draft for non-AcroForm PDFs', async () => {
    mockGenerateFormPDF.mockResolvedValue({
      success: true,
      pdfBytes: new Uint8Array([80, 68, 70]),
      fileName: 'I-130_draft.pdf',
      isAcroFormFilled: false,
    });

    const request = createMockRequest();
    const response = await GET(request, createMockContext());

    expect(response.status).toBe(200);
    expect(response.headers.get('X-PDF-Type')).toBe('draft');
  });

  it('should log PDF download in audit trail', async () => {
    const request = createMockRequest();
    await GET(request, createMockContext());

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'forms',
        record_id: mockFormId,
        operation: 'access',
        additional_context: expect.objectContaining({
          action: 'pdf_download',
          form_type: 'I-130',
        }),
      })
    );
  });

  it('should return PDF for client with access', async () => {
    mockAuthUser = { id: mockClientId, email: 'client@example.com' };
    mockAuthProfile = { id: mockClientId, email: 'client@example.com', role: 'client' };

    mockVerifyFormAccess.mockResolvedValue({
      success: true,
      form: { id: mockFormId, case_id: mockCaseId },
      caseData: { id: mockCaseId, attorney_id: mockAttorneyId, client_id: mockClientId, firm_id: null },
      access: {
        canView: true,
        canModify: false,
        canDelete: false,
        isOwner: false,
        isAttorney: false,
        isClient: true,
      },
    });

    const request = createMockRequest();
    const response = await GET(request, createMockContext());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('should handle thrown errors gracefully', async () => {
    mockGetForm.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate PDF');
  });

  describe('draft query parameter', () => {
    it('should pass isDraft undefined when no draft param provided', async () => {
      const request = createMockRequest();
      await GET(request, createMockContext());

      expect(mockGenerateFormPDF).toHaveBeenCalledWith(
        expect.any(Object),
        { isDraft: undefined },
      );
    });

    it('should pass isDraft false when ?draft=false', async () => {
      const request = createMockRequest('draft=false');
      await GET(request, createMockContext());

      expect(mockGenerateFormPDF).toHaveBeenCalledWith(
        expect.any(Object),
        { isDraft: false },
      );
    });

    it('should pass isDraft true when ?draft=true', async () => {
      const request = createMockRequest('draft=true');
      await GET(request, createMockContext());

      expect(mockGenerateFormPDF).toHaveBeenCalledWith(
        expect.any(Object),
        { isDraft: true },
      );
    });
  });
});
