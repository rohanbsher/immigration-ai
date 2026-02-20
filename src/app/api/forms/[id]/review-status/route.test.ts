import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockFormId = 'form-status-123';
const mockCaseId = 'case-status-789';
const mockAttorneyId = 'attorney-rs-001';
const mockClientId = 'client-rs-002';

const mockForm = {
  id: mockFormId,
  case_id: mockCaseId,
  form_type: 'I-130',
  status: 'ai_filled',
  form_data: { first_name: 'John', last_name: 'Doe' },
  ai_filled_data: { first_name: 'John', last_name: 'Doe', ssn: '123-45-6789' },
  ai_confidence_scores: { first_name: 0.95, last_name: 0.95, ssn: 0.6 },
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  filed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockReviewStatus = {
  formId: '',
  formType: '',
  totalFields: 3,
  reviewedFields: 1,
  pendingReviewFields: 2,
  lowConfidenceFields: [
    {
      fieldName: 'ssn',
      aiValue: '123-45-6789',
      confidence: 0.6,
      requiresReview: true,
      reviewReason: 'Below confidence threshold (0.8)',
      reviewed: false,
    },
  ],
  mandatoryReviewFields: [
    {
      fieldName: 'ssn',
      aiValue: '123-45-6789',
      confidence: 0.6,
      requiresReview: true,
      reviewReason: 'Sensitive field requires mandatory review',
      reviewed: false,
    },
  ],
  canSubmit: false,
  canFile: false,
  blockedReasons: ['1 sensitive field(s) require mandatory review'],
};

// Mock function references
const mockGetForm = vi.fn();
const mockVerifyFormAccess = vi.fn();
const mockAnalyzeFormForReview = vi.fn();
const mockGetReviewSummary = vi.fn();

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

// Mock form validation
vi.mock('@/lib/form-validation', () => ({
  analyzeFormForReview: (...args: unknown[]) => mockAnalyzeFormForReview(...args),
  getReviewSummary: (...args: unknown[]) => mockGetReviewSummary(...args),
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

function createMockRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/forms/${mockFormId}/review-status`,
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

describe('Forms [id] Review-Status API Route', () => {
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

    // Default: review analysis
    mockAnalyzeFormForReview.mockReturnValue({ ...mockReviewStatus });
    mockGetReviewSummary.mockReturnValue('1 sensitive field(s) require mandatory review');
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

  it('should return 200 with review status for attorney', async () => {
    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.formId).toBe(mockFormId);
    expect(data.formType).toBe('I-130');
    expect(data.totalFields).toBe(3);
    expect(data.pendingReviewFields).toBe(2);
    expect(data.canFile).toBe(false);
    expect(data.summary).toBeDefined();
    expect(data.formStatus).toBe('ai_filled');
  });

  it('should return review status for client with access', async () => {
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
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.formId).toBe(mockFormId);
  });

  it('should call analyzeFormForReview with correct arguments', async () => {
    const request = createMockRequest();
    await GET(request, createMockContext());

    expect(mockAnalyzeFormForReview).toHaveBeenCalledWith(
      mockForm.form_data,
      mockForm.ai_filled_data,
      mockForm.ai_confidence_scores,
      undefined // no reviewed_fields_data in form_data
    );
  });

  it('should include review summary in response', async () => {
    mockGetReviewSummary.mockReturnValue('All fields reviewed. Form is ready for filing.');

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(data.summary).toBe('All fields reviewed. Form is ready for filing.');
  });

  it('should handle form with no AI data', async () => {
    mockGetForm.mockResolvedValue({
      ...mockForm,
      ai_filled_data: null,
      ai_confidence_scores: null,
    });

    const emptyReviewStatus = {
      ...mockReviewStatus,
      totalFields: 0,
      reviewedFields: 0,
      pendingReviewFields: 0,
      lowConfidenceFields: [],
      mandatoryReviewFields: [],
      canSubmit: true,
      canFile: true,
      blockedReasons: [],
    };
    mockAnalyzeFormForReview.mockReturnValue(emptyReviewStatus);
    mockGetReviewSummary.mockReturnValue('All fields reviewed. Form is ready for filing.');

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canFile).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    mockGetForm.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await GET(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to get review status');
  });
});
