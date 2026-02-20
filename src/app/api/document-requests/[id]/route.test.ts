import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockRequestId = 'dreq-123';
const mockCaseId = 'case-789';
const mockAttorneyId = 'attorney-001';
const mockClientId = 'client-002';

const mockDocRequest = {
  id: mockRequestId,
  case_id: mockCaseId,
  title: 'Upload passport copy',
  description: 'Please upload a clear copy of your passport',
  status: 'pending',
  priority: 'normal',
  due_date: '2024-02-15',
  fulfilled_by_document_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock function references
const mockGetRequest = vi.fn();
const mockUpdateRequest = vi.fn();
const mockDeleteRequest = vi.fn();
const mockGetCase = vi.fn();
const mockGetUser = vi.fn();
const mockProfileSelect = vi.fn();

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', () => ({
  documentRequestsService: {
    getRequest: (...args: unknown[]) => mockGetRequest(...args),
    updateRequest: (...args: unknown[]) => mockUpdateRequest(...args),
    deleteRequest: (...args: unknown[]) => mockDeleteRequest(...args),
  },
  casesService: {
    getCase: (...args: unknown[]) => mockGetCase(...args),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockProfileSelect(),
        }),
      }),
    }),
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

vi.mock('@/lib/auth/api-helpers', () => ({
  safeParseBody: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { GET, PATCH, DELETE } from './route';
import { standardRateLimiter, sensitiveRateLimiter } from '@/lib/rate-limit';
import { safeParseBody } from '@/lib/auth/api-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockRequest(method: string, body?: Record<string, unknown>) {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
  };
  if (body) init.body = JSON.stringify(body);
  return new NextRequest(
    `http://localhost:3000/api/document-requests/${mockRequestId}`,
    init
  );
}

function createMockContext(id: string = mockRequestId) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Document Requests [id] API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockAttorneyId, email: 'attorney@example.com' } },
    });

    // Default: attorney profile
    mockProfileSelect.mockResolvedValue({
      data: { role: 'attorney' },
      error: null,
    });

    // Default: request exists
    mockGetRequest.mockResolvedValue(mockDocRequest);

    // Default: case exists with attorney access
    mockGetCase.mockResolvedValue({
      id: mockCaseId,
      attorney_id: mockAttorneyId,
      client_id: mockClientId,
    });

    // Default: rate limiters allow
    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as never);
    vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({ allowed: true } as never);

    // Default: body parsing succeeds
    vi.mocked(safeParseBody).mockResolvedValue({
      success: true,
      data: {},
    } as never);

    // Default: update succeeds
    mockUpdateRequest.mockResolvedValue({ ...mockDocRequest, status: 'fulfilled' });

    // Default: delete succeeds
    mockDeleteRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/document-requests/[id]
  // ==========================================================================
  describe('GET', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when request not found', async () => {
      mockGetRequest.mockResolvedValue(null);

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 404 when case not found', async () => {
      mockGetCase.mockResolvedValue(null);

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 404 when user has no access', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'stranger-id', email: 'stranger@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'attorney' }, error: null });

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 200 with document request for attorney', async () => {
      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockRequestId);
      expect(data.title).toBe('Upload passport copy');
    });

    it('should return 200 for client with access', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'client' }, error: null });

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockRequestId);
    });

    it('should apply rate limiting by user.id', async () => {
      await GET(createMockRequest('GET'), createMockContext());

      expect(standardRateLimiter.limit).toHaveBeenCalledWith(
        expect.any(NextRequest),
        mockAttorneyId
      );
    });

    it('should return rate limit response when rate limited', async () => {
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 }),
      } as never);

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too Many Requests');
    });

    it('should return 500 when an unexpected error occurs', async () => {
      mockGetRequest.mockRejectedValue(new Error('DB error'));

      const response = await GET(createMockRequest('GET'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch document request');
    });
  });

  // ==========================================================================
  // PATCH /api/document-requests/[id]
  // ==========================================================================
  describe('PATCH', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when request not found', async () => {
      mockGetRequest.mockResolvedValue(null);
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'fulfilled' },
      } as never);

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 200 when attorney updates request', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'fulfilled', title: 'Updated title' },
      } as never);
      mockUpdateRequest.mockResolvedValue({ ...mockDocRequest, status: 'fulfilled', title: 'Updated title' });

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('fulfilled');
      expect(mockUpdateRequest).toHaveBeenCalledWith(mockRequestId, {
        status: 'fulfilled',
        title: 'Updated title',
      });
    });

    it('should allow client to update status to uploaded', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'client' }, error: null });
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'uploaded' },
      } as never);
      mockUpdateRequest.mockResolvedValue({ ...mockDocRequest, status: 'uploaded' });

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('uploaded');
    });

    it('should return 403 when client tries to update disallowed fields', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'client' }, error: null });
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { title: 'Hacked title' },
      } as never);

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Clients can only update status');
    });

    it('should return 403 when client tries to set status to non-uploaded value', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'client' }, error: null });
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'fulfilled' },
      } as never);

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Clients can only set status to uploaded');
    });

    it('should return error when body parsing fails', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: false,
        response: new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }),
      } as never);

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });

    it('should return 400 for invalid zod data', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'invalid_status' },
      } as never);

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 500 when update throws', async () => {
      vi.mocked(safeParseBody).mockResolvedValue({
        success: true,
        data: { status: 'fulfilled' },
      } as never);
      mockUpdateRequest.mockRejectedValue(new Error('DB error'));

      const response = await PATCH(createMockRequest('PATCH'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update document request');
    });
  });

  // ==========================================================================
  // DELETE /api/document-requests/[id]
  // ==========================================================================
  describe('DELETE', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when request not found', async () => {
      mockGetRequest.mockResolvedValue(null);

      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 403 when client tries to delete', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: mockClientId, email: 'client@example.com' } },
      });
      mockProfileSelect.mockResolvedValue({ data: { role: 'client' }, error: null });

      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Only attorneys can delete');
    });

    it('should return 200 when attorney deletes request', async () => {
      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDeleteRequest).toHaveBeenCalledWith(mockRequestId);
    });

    it('should use sensitive rate limiter for destructive action', async () => {
      await DELETE(createMockRequest('DELETE'), createMockContext());

      expect(sensitiveRateLimiter.limit).toHaveBeenCalledWith(
        expect.any(NextRequest),
        mockAttorneyId
      );
    });

    it('should return rate limit response when rate limited', async () => {
      vi.mocked(sensitiveRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 }),
      } as never);

      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too Many Requests');
    });

    it('should return 500 when delete throws', async () => {
      mockDeleteRequest.mockRejectedValue(new Error('DB error'));

      const response = await DELETE(createMockRequest('DELETE'), createMockContext());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete document request');
    });
  });
});
