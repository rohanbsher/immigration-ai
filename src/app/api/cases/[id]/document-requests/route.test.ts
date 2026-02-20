import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
const UNAUTHORIZED_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440020';

const mockCase = {
  id: CASE_ID,
  attorney_id: ATTORNEY_ID,
  client_id: CLIENT_ID,
  visa_type: 'H1B',
  status: 'intake',
  title: 'H1B Application',
};

const mockDocumentRequest = {
  id: REQUEST_ID,
  case_id: CASE_ID,
  requested_by: ATTORNEY_ID,
  document_type: 'passport',
  title: 'Upload Passport',
  description: 'Please upload a copy of your passport',
  due_date: '2024-06-01',
  priority: 'high',
  status: 'pending',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock Supabase user
let mockSupabaseUser: { id: string; email: string } | null = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
};

// Track profile role for verifyCaseAccess admin check
let mockProfileRole = 'attorney';

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: { user: mockSupabaseUser }, error: null })
    ),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: { role: mockProfileRole }, error: null })
    ),
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock db services
const mockDocumentRequestsService = {
  getRequestsByCase: vi.fn().mockResolvedValue([mockDocumentRequest]),
  getPendingRequestsByCase: vi.fn().mockResolvedValue([mockDocumentRequest]),
  createRequest: vi.fn().mockResolvedValue(mockDocumentRequest),
};

const mockCasesService = {
  getCase: vi.fn().mockResolvedValue(mockCase),
};

vi.mock('@/lib/db', () => ({
  documentRequestsService: mockDocumentRequestsService,
  casesService: mockCasesService,
}));

// Mock validation
vi.mock('@/lib/validation', () => ({
  DOCUMENT_TYPES: [
    'passport', 'visa', 'i94', 'birth_certificate', 'marriage_certificate',
    'divorce_certificate', 'employment_letter', 'pay_stub', 'tax_return',
    'w2', 'bank_statement', 'photo', 'medical_exam', 'police_clearance',
    'diploma', 'transcript', 'recommendation_letter', 'other',
  ] as const,
}));

// Mock rate limiting
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
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  }),
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

function createMockRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  const { method = 'GET', body } = options;
  const requestInit: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    requestInit.body = JSON.stringify(body);
  }
  const request = new NextRequest(new URL(url, 'http://localhost:3000'), requestInit);
  if (body) {
    request.json = async () => body;
  }
  return request;
}

function setCurrentUser(
  user: { id: string; email: string } | null,
  role: string = 'attorney'
) {
  mockSupabaseUser = user;
  mockProfileRole = role;
}

describe('Document Requests API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ id: ATTORNEY_ID, email: 'attorney@example.com' }, 'attorney');
    mockCasesService.getCase.mockResolvedValue(mockCase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cases/[id]/document-requests', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user has no case access', async () => {
      setCurrentUser({ id: UNAUTHORIZED_USER_ID, email: 'other@example.com' }, 'client');

      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 403 when case does not exist', async () => {
      mockCasesService.getCase.mockResolvedValueOnce(null);

      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 200 with all requests for attorney', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(mockDocumentRequestsService.getRequestsByCase).toHaveBeenCalledWith(CASE_ID);
    });

    it('should return 200 with all requests for client', async () => {
      setCurrentUser({ id: CLIENT_ID, email: 'client@example.com' }, 'client');

      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
    });

    it('should return only pending requests when pending=true', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests?pending=true`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockDocumentRequestsService.getPendingRequestsByCase).toHaveBeenCalledWith(CASE_ID);
      expect(mockDocumentRequestsService.getRequestsByCase).not.toHaveBeenCalled();
    });

    it('should return all requests when pending param is not true', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests?pending=false`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockDocumentRequestsService.getRequestsByCase).toHaveBeenCalledWith(CASE_ID);
      expect(mockDocumentRequestsService.getPendingRequestsByCase).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockDocumentRequestsService.getRequestsByCase.mockRejectedValueOnce(
        new Error('DB error')
      );

      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`
      );

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/cases/[id]/document-requests', () => {
    const validRequestData = {
      document_type: 'passport',
      title: 'Upload Passport',
      description: 'Please upload a copy of your passport',
      due_date: '2024-06-01',
      priority: 'high',
    };

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        { method: 'POST', body: validRequestData }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user has no case access', async () => {
      setCurrentUser({ id: UNAUTHORIZED_USER_ID, email: 'other@example.com' }, 'client');

      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        { method: 'POST', body: validRequestData }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 403 when client tries to create request', async () => {
      setCurrentUser({ id: CLIENT_ID, email: 'client@example.com' }, 'client');

      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        { method: 'POST', body: validRequestData }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Only attorneys can create document requests');
    });

    it('should return 400 for invalid document_type', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        {
          method: 'POST',
          body: { ...validRequestData, document_type: 'invalid_type' },
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing title', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        {
          method: 'POST',
          body: { document_type: 'passport' },
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty title', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        {
          method: 'POST',
          body: { ...validRequestData, title: '' },
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(400);
    });

    it('should return 201 when attorney creates document request', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        { method: 'POST', body: validRequestData }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe(REQUEST_ID);
      expect(mockDocumentRequestsService.createRequest).toHaveBeenCalledWith({
        case_id: CASE_ID,
        requested_by: ATTORNEY_ID,
        ...validRequestData,
      });
    });

    it('should return 201 with minimal required fields', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        {
          method: 'POST',
          body: { document_type: 'passport', title: 'Upload Passport' },
        }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(201);
    });

    it('should handle service errors gracefully', async () => {
      mockDocumentRequestsService.createRequest.mockRejectedValueOnce(
        new Error('DB error')
      );

      const { POST } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/document-requests`,
        { method: 'POST', body: validRequestData }
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });
  });
});
