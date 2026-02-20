import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockDocumentId = 'doc-verify-123';
const mockAttorneyId = 'attorney-001';
const mockClientId = 'client-002';

const mockVerifiedDocument = {
  id: mockDocumentId,
  case_id: 'case-789',
  uploaded_by: mockAttorneyId,
  document_type: 'passport',
  status: 'verified',
  verified_by: mockAttorneyId,
  verified_at: '2024-01-15T00:00:00Z',
};

// Mock function references
const mockVerifyDocumentAccess = vi.fn();
const mockVerifyDocument = vi.fn();

// Shared mock auth state - controls what withAuth returns
let mockAuthUser: { id: string; email: string } | null = null;
let mockAuthProfile: Record<string, unknown> | null = null;

// Mock Supabase (required by dependencies but not directly used)
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
  documentsService: {
    verifyDocument: (...args: unknown[]) => mockVerifyDocument(...args),
  },
}));

// Mock auth helpers with withAuth that uses the shared state
vi.mock('@/lib/auth/api-helpers', () => {
  const errorResponseFn = (error: string, status: number) =>
    NextResponse.json({ success: false, error }, { status });

  const successResponseFn = (data: unknown, status = 200) =>
    NextResponse.json({ success: true, data }, { status });

  const withAuth = (handler: Function) => {
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
    successResponse: successResponseFn,
    verifyDocumentAccess: (...args: unknown[]) => mockVerifyDocumentAccess(...args),
  };
});

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
import { POST } from './route';

function createMockRequest(): NextRequest {
  const url = `http://localhost:3000/api/documents/${mockDocumentId}/verify`;
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

function createMockContext(id: string = mockDocumentId) {
  return { params: Promise.resolve({ id }) };
}

describe('Documents [id] Verify API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated as attorney
    mockAuthUser = { id: mockAttorneyId, email: 'attorney@example.com' };
    mockAuthProfile = {
      id: mockAttorneyId,
      email: 'attorney@example.com',
      role: 'attorney',
    };

    // Default: document access granted (attorney)
    mockVerifyDocumentAccess.mockResolvedValue({
      success: true,
      document: { id: mockDocumentId, case_id: 'case-789', uploaded_by: mockAttorneyId },
      caseData: { id: 'case-789', attorney_id: mockAttorneyId, client_id: mockClientId, firm_id: null },
      access: {
        canView: true,
        canModify: true,
        canDelete: true,
        isOwner: true,
        isAttorney: true,
        isClient: false,
      },
    });

    mockVerifyDocument.mockResolvedValue(mockVerifiedDocument);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthUser = null;

    const request = createMockRequest();
    const response = await POST(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when non-attorney tries to verify', async () => {
    mockAuthUser = { id: mockClientId, email: 'client@example.com' };
    mockAuthProfile = { id: mockClientId, email: 'client@example.com', role: 'client' };

    mockVerifyDocumentAccess.mockResolvedValue({
      success: true,
      document: { id: mockDocumentId, case_id: 'case-789', uploaded_by: mockAttorneyId },
      caseData: { id: 'case-789', attorney_id: mockAttorneyId, client_id: mockClientId, firm_id: null },
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
    const response = await POST(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the assigned attorney');
  });

  it('should return 404 when document not found', async () => {
    mockVerifyDocumentAccess.mockResolvedValue({
      success: false,
      error: 'Document not found',
      status: 404,
    });

    const request = createMockRequest();
    const response = await POST(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Document not found');
  });

  it('should return 200 when attorney verifies document', async () => {
    const request = createMockRequest();
    const response = await POST(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(mockDocumentId);
    expect(data.data.status).toBe('verified');
    expect(mockVerifyDocument).toHaveBeenCalledWith(mockDocumentId, mockAttorneyId);
  });

  it('should return 500 when verification fails', async () => {
    mockVerifyDocument.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await POST(request, createMockContext());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to verify document');
  });
});
