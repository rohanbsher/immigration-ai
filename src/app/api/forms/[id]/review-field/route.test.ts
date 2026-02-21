import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFormId = 'form-review-123';
const mockCaseId = 'case-review-789';
const mockAttorneyId = 'attorney-rf-001';
const mockClientId = 'client-rf-002';

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

const mockCase = {
  id: mockCaseId,
  attorney_id: mockAttorneyId,
  client_id: mockClientId,
  visa_type: 'H1B',
  status: 'in_review',
  title: 'Test Case',
};

// Mock Supabase client
const mockProfileQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnValue(mockProfileQuery),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// Mock db services
const mockGetForm = vi.fn();
const mockUpdateForm = vi.fn();
const mockGetCase = vi.fn();

vi.mock('@/lib/db', () => ({
  formsService: {
    getForm: (...args: unknown[]) => mockGetForm(...args),
    updateForm: (...args: unknown[]) => mockUpdateForm(...args),
  },
  casesService: {
    getCase: (...args: unknown[]) => mockGetCase(...args),
  },
}));

// Mock audit
const mockAuditLog = vi.fn().mockResolvedValue(undefined);

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

// Mock api-helpers: use importOriginal to keep withAuth, successResponse, errorResponse, etc.
vi.mock('@/lib/auth/api-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/api-helpers')>();
  return {
    ...actual,
  };
});

// Import after mocks
import { POST } from './route';
import { getProfileAsAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

function createMockRequest(
  body?: Record<string, unknown>,
): NextRequest {
  const url = `http://localhost:3000/api/forms/${mockFormId}/review-field`;
  const requestInit: RequestInit = {
    method: 'POST',
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

function createMockParams(id: string = mockFormId): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('Forms [id] Review-Field API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
      error: null,
    });

    // withAuth calls getProfileAsAdmin after auth
    vi.mocked(getProfileAsAdmin).mockResolvedValue({
      profile: { id: mockAttorneyId, role: 'attorney', full_name: 'Test Attorney', email: 'attorney@example.com' },
      error: null,
    } as any);

    mockGetForm.mockResolvedValue(mockForm);
    mockGetCase.mockResolvedValue(mockCase);

    // Reset rate limiter to allowed (withAuth uses rateLimit, not standardRateLimiter.limit)
    vi.mocked(rateLimit).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 when form not found', async () => {
    mockGetForm.mockResolvedValue(null);

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Form not found');
  });

  it('should return 404 when case not found', async () => {
    mockGetCase.mockResolvedValue(null);

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Case not found');
  });

  it('should return 403 when non-attorney tries to review', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockClientId, email: 'client@example.com' } },
      error: null,
    });

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the assigned attorney');
  });

  it('should return 403 when different attorney tries to review', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'other-attorney', email: 'other@example.com' } },
      error: null,
    });

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the assigned attorney');
  });

  it('should return 400 when fieldName is missing', async () => {
    const request = createMockRequest({ acceptedValue: '123-45-6789' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when fieldName is empty string', async () => {
    const request = createMockRequest({ fieldName: '', acceptedValue: '123' });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Field name is required');
  });

  it('should return 200 and review the field when attorney reviews', async () => {
    const updatedForm = {
      ...mockForm,
      form_data: {
        ...mockForm.form_data,
        ssn: '123-45-6789',
        reviewed_fields_data: {
          reviewed_fields: {
            ssn: {
              reviewed_at: expect.any(String),
              reviewed_by: mockAttorneyId,
              original_value: '123-45-6789',
              accepted_value: '123-45-6789',
              notes: null,
            },
          },
        },
      },
    };
    mockUpdateForm.mockResolvedValue(updatedForm);

    const request = createMockRequest({
      fieldName: 'ssn',
      acceptedValue: '123-45-6789',
    });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('ssn');
    expect(data.data.reviewRecord).toBeDefined();
    expect(data.data.reviewRecord.reviewed_by).toBe(mockAttorneyId);
    expect(data.data.reviewRecord.accepted_value).toBe('123-45-6789');
  });

  it('should log review in audit trail', async () => {
    mockUpdateForm.mockResolvedValue(mockForm);

    const request = createMockRequest({
      fieldName: 'ssn',
      acceptedValue: '999-99-9999',
      notes: 'Corrected SSN',
    });
    await POST(request, { params: createMockParams() });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'forms',
        record_id: mockFormId,
        operation: 'update',
        additional_context: expect.objectContaining({
          action: 'field_review',
          field_name: 'ssn',
          attorney_accepted_value: '999-99-9999',
          review_notes: 'Corrected SSN',
        }),
      })
    );
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 60 });

    const request = createMockRequest({ fieldName: 'ssn', acceptedValue: '123' });
    const response = await POST(request, { params: createMockParams() });

    expect(response.status).toBe(429);
  });

  it('should handle database errors gracefully', async () => {
    mockUpdateForm.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest({
      fieldName: 'ssn',
      acceptedValue: '123-45-6789',
    });
    const response = await POST(request, { params: createMockParams() });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
