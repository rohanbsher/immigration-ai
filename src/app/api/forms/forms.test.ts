/**
 * Integration tests for Forms API routes.
 *
 * Tests cover:
 * - GET /api/forms/[id] - Fetch a specific form
 * - PATCH /api/forms/[id] - Update a form
 * - DELETE /api/forms/[id] - Delete a form
 * - POST /api/forms/[id]/autofill - AI autofill a form
 * - POST /api/forms/[id]/review - Review and approve a form
 * - POST /api/forms/[id]/file - Mark a form as filed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockAttorneyId = 'attorney-123';
const mockClientId = 'client-456';
const mockCaseId = 'case-789';
const mockFormId = 'form-abc';

const mockForm = {
  id: mockFormId,
  case_id: mockCaseId,
  form_type: 'I-130',
  status: 'draft',
  form_data: { first_name: 'John', last_name: 'Doe' },
  ai_filled_data: null,
  ai_confidence_scores: null,
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  filed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  reviewer: null,
};

const mockCase = {
  id: mockCaseId,
  attorney_id: mockAttorneyId,
  client_id: mockClientId,
  visa_type: 'H-1B',
  status: 'in_review',
  title: 'Test Case',
};

const mockDocuments = [
  {
    id: 'doc-1',
    case_id: mockCaseId,
    document_type: 'passport',
    status: 'analyzed',
    ai_extracted_data: {
      full_name: { value: 'John Doe', confidence: 0.95 },
      date_of_birth: { value: '1990-01-15', confidence: 0.9 },
    },
    ai_confidence_score: 0.92,
  },
];

const mockAutofillResult = {
  form_type: 'I-130',
  fields: [
    {
      field_id: 'first_name',
      suggested_value: 'John',
      confidence: 0.95,
      requires_review: false,
    },
    {
      field_id: 'last_name',
      suggested_value: 'Doe',
      confidence: 0.95,
      requires_review: false,
    },
    {
      field_id: 'date_of_birth',
      suggested_value: '1990-01-15',
      confidence: 0.9,
      requires_review: true,
    },
  ],
  overall_confidence: 0.93,
  processing_time_ms: 1500,
  missing_documents: [],
  warnings: [],
};

// Mock the supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock createClient function
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock db services
vi.mock('@/lib/db', () => ({
  formsService: {
    getForm: vi.fn(),
    updateForm: vi.fn(),
    deleteForm: vi.fn(),
    reviewForm: vi.fn(),
    markAsFiled: vi.fn(),
  },
  casesService: {
    getCase: vi.fn(),
  },
  documentsService: {
    getDocumentsByCase: vi.fn(),
  },
}));

// Mock AI service
vi.mock('@/lib/ai', () => ({
  autofillForm: vi.fn(),
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

// Import handlers after mocks are set up
import { GET, PATCH, DELETE } from './[id]/route';
import { POST as autofillPOST } from './[id]/autofill/route';
import { POST as reviewPOST } from './[id]/review/route';
import { POST as filePOST } from './[id]/file/route';
import { formsService, casesService, documentsService } from '@/lib/db';
import { autofillForm } from '@/lib/ai';
import { aiRateLimiter } from '@/lib/rate-limit';

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const url = `http://localhost:3000/api/forms/${mockFormId}`;
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const request = new NextRequest(url, requestInit);

  // Override json() method to properly return the body in jsdom environment
  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create mock params
function createMockParams(id: string = mockFormId): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('Forms API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/forms/[id]
  // ==========================================================================
  describe('GET /api/forms/[id]', () => {
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

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 404 when case does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 404 when user has no access to the case', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue({
        ...mockCase,
        attorney_id: 'other-attorney',
        client_id: 'other-client',
      } as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return form when attorney has access', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockFormId);
      expect(data.form_type).toBe('I-130');
    });

    it('should return form when client has access', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockFormId);
    });
  });

  // ==========================================================================
  // PATCH /api/forms/[id]
  // ==========================================================================
  describe('PATCH /api/forms/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('PATCH', { status: 'in_review' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('PATCH', { status: 'in_review' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 403 when client tries to modify form', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('PATCH', { status: 'in_review' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 for invalid update data', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      // Send invalid data (invalid type for form_data)
      const request = createMockRequest('PATCH', { form_data: 'invalid' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should update form when attorney modifies', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.updateForm).mockResolvedValue({
        ...mockForm,
        status: 'in_review',
      } as ReturnType<typeof formsService.updateForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('PATCH', { status: 'in_review' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('in_review');
      expect(formsService.updateForm).toHaveBeenCalledWith(mockFormId, { status: 'in_review' });
    });

    it('should update form_data when attorney modifies', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const newFormData = { first_name: 'Jane', last_name: 'Smith' };
      vi.mocked(formsService.updateForm).mockResolvedValue({
        ...mockForm,
        form_data: newFormData,
      } as ReturnType<typeof formsService.updateForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('PATCH', { form_data: newFormData });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.form_data).toEqual(newFormData);
    });
  });

  // ==========================================================================
  // DELETE /api/forms/[id]
  // ==========================================================================
  describe('DELETE /api/forms/[id]', () => {
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

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 403 when client tries to delete form', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should delete form when attorney requests', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.deleteForm).mockResolvedValue(undefined);

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Form deleted successfully');
      expect(formsService.deleteForm).toHaveBeenCalledWith(mockFormId);
    });
  });

  // ==========================================================================
  // POST /api/forms/[id]/autofill
  // ==========================================================================
  describe('POST /api/forms/[id]/autofill', () => {
    beforeEach(() => {
      vi.mocked(aiRateLimiter.limit).mockResolvedValue({ allowed: true });

      // CAS update mock: supabase.from('forms').update(...).eq(...).eq(...).select(...).single()
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockFormId },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(aiRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }) as any,
      });

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });

      expect(response.status).toBe(429);
    });

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 403 when non-attorney tries to autofill', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return 400 when no analyzed documents available and reset status', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(documentsService.getDocumentsByCase).mockResolvedValue([]);
      vi.mocked(formsService.updateForm).mockResolvedValue(mockForm as any);

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No analyzed documents available');
      // Verify status was reset after CAS had set it to 'autofilling'
      expect(formsService.updateForm).toHaveBeenCalledWith(mockFormId, { status: 'draft' });
    });

    it('should autofill form successfully with analyzed documents', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(documentsService.getDocumentsByCase).mockResolvedValue(mockDocuments as any);
      vi.mocked(autofillForm).mockResolvedValue(mockAutofillResult);
      vi.mocked(formsService.updateForm).mockResolvedValue({
        ...mockForm,
        status: 'ai_filled',
        ai_filled_data: { first_name: 'John', last_name: 'Doe' },
        ai_confidence_scores: { first_name: 0.95, last_name: 0.91 },
      } as ReturnType<typeof formsService.updateForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.form.status).toBe('ai_filled');
      expect(data.autofill.overall_confidence).toBe(0.93);
      expect(data.autofill.fields_filled).toBe(3);
      expect(autofillForm).toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(documentsService.getDocumentsByCase).mockResolvedValue(mockDocuments as any);
      vi.mocked(autofillForm).mockRejectedValue(new Error('AI service unavailable'));

      const request = createMockRequest('POST');
      const response = await autofillPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI autofill failed');
    });
  });

  // ==========================================================================
  // POST /api/forms/[id]/review
  // ==========================================================================
  describe('POST /api/forms/[id]/review', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('POST', { notes: 'Approved' });
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('POST', { notes: 'Approved' });
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 403 when non-attorney tries to review', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST', { notes: 'Approved' });
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only the assigned attorney can review forms');
    });

    it('should return 403 when different attorney tries to review', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'other-attorney', email: 'other@example.com' } },
        error: null,
      });

      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST', { notes: 'Approved' });
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only the assigned attorney can review forms');
    });

    it('should review and approve form when attorney reviews', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.reviewForm).mockResolvedValue({
        ...mockForm,
        status: 'approved',
        review_notes: 'Looks good',
        reviewed_by: mockAttorneyId,
        reviewed_at: new Date().toISOString(),
      } as ReturnType<typeof formsService.reviewForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST', { notes: 'Looks good' });
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('approved');
      expect(data.review_notes).toBe('Looks good');
      expect(formsService.reviewForm).toHaveBeenCalledWith(mockFormId, 'Looks good');
    });

    it('should review form with empty notes', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.reviewForm).mockResolvedValue({
        ...mockForm,
        status: 'approved',
        review_notes: '',
        reviewed_by: mockAttorneyId,
        reviewed_at: new Date().toISOString(),
      } as ReturnType<typeof formsService.reviewForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST', {});
      const response = await reviewPOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('approved');
    });
  });

  // ==========================================================================
  // POST /api/forms/[id]/file
  // ==========================================================================
  describe('POST /api/forms/[id]/file', () => {
    beforeEach(() => {
      // Mock the profile query for role check
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'attorney' },
          error: null,
        }),
      });
    });

    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createMockRequest('POST');
      const response = await filePOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when non-attorney tries to file', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'client' },
          error: null,
        }),
      });

      const request = createMockRequest('POST');
      const response = await filePOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only attorneys can mark forms as filed');
    });

    it('should return 404 when form does not exist', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(null);

      const request = createMockRequest('POST');
      const response = await filePOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Form not found');
    });

    it('should return 400 when form is not approved', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue({
        ...mockForm,
        status: 'draft',
      } as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST');
      const response = await filePOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Form must be approved before filing');
    });

    it('should mark form as filed when approved', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue({
        ...mockForm,
        status: 'approved',
      } as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.markAsFiled).mockResolvedValue({
        ...mockForm,
        status: 'filed',
        filed_at: new Date().toISOString(),
      } as ReturnType<typeof formsService.markAsFiled> extends Promise<infer T> ? T : never);

      const request = createMockRequest('POST');
      const response = await filePOST(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('filed');
      expect(formsService.markAsFiled).toHaveBeenCalledWith(mockFormId);
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================
  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(formsService.getForm).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('GET');
      const response = await GET(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch form');
    });

    it('should handle update database errors gracefully', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.updateForm).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('PATCH', { status: 'in_review' });
      const response = await PATCH(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update form');
    });

    it('should handle delete database errors gracefully', async () => {
      vi.mocked(formsService.getForm).mockResolvedValue(mockForm as ReturnType<typeof formsService.getForm> extends Promise<infer T> ? T : never);
      vi.mocked(casesService.getCase).mockResolvedValue(mockCase as ReturnType<typeof casesService.getCase> extends Promise<infer T> ? T : never);
      vi.mocked(formsService.deleteForm).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('DELETE');
      const response = await DELETE(request, { params: createMockParams() });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete form');
    });
  });
});
