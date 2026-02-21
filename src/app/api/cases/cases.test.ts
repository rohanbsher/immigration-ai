import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// UUID constants for consistent test data
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
const DOCUMENT_ID = '550e8400-e29b-41d4-a716-446655440004';
const FORM_ID = '550e8400-e29b-41d4-a716-446655440005';
const UNAUTHORIZED_USER_ID = '550e8400-e29b-41d4-a716-446655440099';

// Mock data
const mockAttorneyUser = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
  user_metadata: { full_name: 'Attorney User' },
};

const mockClientUser = {
  id: CLIENT_ID,
  email: 'client@example.com',
  user_metadata: { full_name: 'Client User' },
};

const mockUnauthorizedUser = {
  id: UNAUTHORIZED_USER_ID,
  email: 'other@example.com',
  user_metadata: { full_name: 'Other User' },
};

const mockAttorneyProfile = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
  role: 'attorney',
  first_name: 'Attorney',
  last_name: 'User',
  phone: null,
  mfa_enabled: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockClientProfile = {
  id: CLIENT_ID,
  email: 'client@example.com',
  role: 'client',
  first_name: 'Client',
  last_name: 'User',
  phone: null,
  mfa_enabled: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockAdminProfile = {
  id: ADMIN_ID,
  email: 'admin@example.com',
  role: 'admin',
  first_name: 'Admin',
  last_name: 'User',
  phone: null,
  mfa_enabled: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockCase = {
  id: CASE_ID,
  attorney_id: ATTORNEY_ID,
  client_id: CLIENT_ID,
  visa_type: 'H1B',
  status: 'intake',
  title: 'H1B Application',
  description: 'Test case description',
  priority_date: null,
  deadline: null,
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  attorney: { id: ATTORNEY_ID, first_name: 'Attorney', last_name: 'User', email: 'attorney@example.com' },
  client: { id: CLIENT_ID, first_name: 'Client', last_name: 'User', email: 'client@example.com' },
  documents_count: 0,
  forms_count: 0,
};

const mockDocument = {
  id: DOCUMENT_ID,
  case_id: CASE_ID,
  uploaded_by: ATTORNEY_ID,
  document_type: 'passport',
  status: 'uploaded',
  file_name: 'passport.pdf',
  file_url: `${CASE_ID}/1234567890-abc123.pdf`,
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
  uploader: { id: ATTORNEY_ID, first_name: 'Attorney', last_name: 'User' },
};

const mockForm = {
  id: FORM_ID,
  case_id: CASE_ID,
  form_type: 'I-129',
  status: 'draft',
  form_data: {},
  ai_filled_data: null,
  ai_confidence_scores: null,
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  filed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockCaseStats = {
  total: 10,
  byStatus: {
    intake: 3,
    document_collection: 2,
    in_review: 2,
    approved: 3,
  },
  pendingDeadlines: 2,
};

// Mock the Supabase client
let mockSupabaseUser: typeof mockAttorneyUser | null = mockAttorneyUser;
let mockSupabaseProfile: typeof mockAttorneyProfile | null = mockAttorneyProfile;

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
      Promise.resolve({ data: mockSupabaseProfile, error: null })
    ),
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed/file.pdf' }, error: null }),
    }),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock getProfileAsAdmin from admin module
vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn().mockImplementation((userId: string) => {
    if (userId === ATTORNEY_ID) {
      return Promise.resolve({ profile: mockAttorneyProfile, error: null });
    }
    if (userId === CLIENT_ID) {
      return Promise.resolve({ profile: mockClientProfile, error: null });
    }
    if (userId === ADMIN_ID) {
      return Promise.resolve({ profile: mockAdminProfile, error: null });
    }
    if (userId === UNAUTHORIZED_USER_ID) {
      return Promise.resolve({
        profile: { ...mockClientProfile, id: UNAUTHORIZED_USER_ID },
        error: null
      });
    }
    return Promise.resolve({ profile: null, error: new Error('Profile not found') });
  }),
  getAdminClient: vi.fn(),
}));

// Mock the db services
const mockCasesService = {
  getCases: vi.fn().mockResolvedValue({ cases: [mockCase], total: 1 }),
  getCase: vi.fn().mockResolvedValue(mockCase),
  createCase: vi.fn().mockResolvedValue(mockCase),
  updateCase: vi.fn().mockResolvedValue({ ...mockCase, title: 'Updated Title' }),
  deleteCase: vi.fn().mockResolvedValue(undefined),
  getCaseStats: vi.fn().mockResolvedValue(mockCaseStats),
};

const mockDocumentsService = {
  getDocumentsByCase: vi.fn().mockResolvedValue([mockDocument]),
  createDocument: vi.fn().mockResolvedValue(mockDocument),
};

const mockFormsService = {
  getFormsByCase: vi.fn().mockResolvedValue([mockForm]),
  createForm: vi.fn().mockResolvedValue(mockForm),
};

const mockActivitiesService = {
  logCaseCreated: vi.fn().mockResolvedValue(undefined),
  logCaseUpdated: vi.fn().mockResolvedValue(undefined),
  logStatusChanged: vi.fn().mockResolvedValue(undefined),
  logDocumentUploaded: vi.fn().mockResolvedValue(undefined),
  logFormCreated: vi.fn().mockResolvedValue(undefined),
  getActivitiesByCase: vi.fn().mockResolvedValue([]),
};

vi.mock('@/lib/db', () => ({
  casesService: mockCasesService,
  documentsService: mockDocumentsService,
  formsService: mockFormsService,
  activitiesService: mockActivitiesService,
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

// Mock billing quota enforcement
vi.mock('@/lib/billing/quota', () => ({
  enforceQuota: vi.fn().mockResolvedValue(undefined),
  enforceQuotaForCase: vi.fn().mockResolvedValue(undefined),
  QuotaExceededError: class QuotaExceededError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'QuotaExceededError';
    }
  },
}));

// Mock file validation
vi.mock('@/lib/file-validation', () => ({
  validateFile: vi.fn().mockResolvedValue({
    isValid: true,
    typeValidation: { isValid: true, warnings: [] },
    virusScan: { isClean: true },
  }),
}));

// Mock email notifications
vi.mock('@/lib/email/notifications', () => ({
  sendDocumentUploadedEmail: vi.fn().mockResolvedValue(undefined),
  sendCaseUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendCaseCreatedEmail: vi.fn().mockResolvedValue(undefined),
}));

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

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

  const request = new NextRequest(new URL(url, 'http://localhost:3000'), requestInit);

  // Override json() method to properly return the body in jsdom environment
  if (body) {
    request.json = async () => body;
  }

  return request;
}

// Helper to create mock NextRequest with FormData for jsdom environment
function createMockFormDataRequest(
  url: string,
  formData: FormData
): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
  });

  // Override formData() method to properly return FormData in jsdom environment
  request.formData = async () => formData;

  return request;
}

// Helper to set the current user for tests
function setCurrentUser(user: typeof mockAttorneyUser | null, profile: typeof mockAttorneyProfile | null) {
  mockSupabaseUser = user;
  mockSupabaseProfile = profile;
}

describe('Cases API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser(mockAttorneyUser, mockAttorneyProfile);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cases', () => {
    it('should return cases list for authenticated user', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.cases).toHaveLength(1);
      expect(data.data.total).toBe(1);
      expect(mockCasesService.getCases).toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { GET } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should pass filter parameters to service', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        'http://localhost:3000/api/cases?status=intake&visa_type=H1B&search=test&page=2&limit=20'
      );

      await GET(request);

      // The route wraps single values in arrays when using getAll()
      expect(mockCasesService.getCases).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['intake'],
          visa_type: ['H1B'],
          search: 'test',
        }),
        expect.objectContaining({
          page: 2,
          limit: 20,
          sortBy: 'created_at',
          sortOrder: 'desc',
        })
      );
    });

    it('should handle multiple status filters', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        'http://localhost:3000/api/cases?status=intake&status=in_review'
      );

      await GET(request);

      expect(mockCasesService.getCases).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['intake', 'in_review'],
        }),
        expect.any(Object)
      );
    });
  });

  describe('POST /api/cases', () => {
    const validCaseData = {
      client_id: CLIENT_ID,
      visa_type: 'H1B',
      title: 'New H1B Application',
      description: 'Test description',
    };

    it('should create a case for attorney', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: validCaseData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockCasesService.createCase).toHaveBeenCalledWith(
        validCaseData,
        ATTORNEY_ID,
        undefined
      );
      expect(mockActivitiesService.logCaseCreated).toHaveBeenCalledWith(
        CASE_ID,
        validCaseData.title,
        ATTORNEY_ID
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: validCaseData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-attorney user', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: validCaseData,
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid data', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: { client_id: 'not-a-uuid' }, // missing required fields
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate client_id is a UUID', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: {
          ...validCaseData,
          client_id: 'invalid-uuid',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid client ID');
    });
  });

  describe('GET /api/cases/[id]', () => {
    it('should return case for attorney owner', async () => {
      const { GET } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe(CASE_ID);
    });

    it('should return case for client on the case', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { GET } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe(CASE_ID);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { GET } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 for unauthorized user', async () => {
      setCurrentUser(mockUnauthorizedUser, { ...mockClientProfile, id: UNAUTHORIZED_USER_ID });

      const { GET } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent case', async () => {
      mockCasesService.getCase.mockResolvedValueOnce(null);

      const { GET } = await import('./[id]/route');
      const request = createMockRequest('http://localhost:3000/api/cases/non-existent');

      const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/cases/[id]', () => {
    const updateData = {
      title: 'Updated Title',
      status: 'in_review',
    };

    it('should update case for attorney owner', async () => {
      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: updateData,
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCasesService.updateCase).toHaveBeenCalledWith(CASE_ID, updateData);
      expect(data.data.title).toBe('Updated Title');
      // Status changed from 'intake' to 'in_review'
      expect(mockActivitiesService.logStatusChanged).toHaveBeenCalledWith(
        CASE_ID,
        'intake',
        'in_review',
        ATTORNEY_ID
      );
    });

    it('should log general update when status does not change', async () => {
      const titleOnlyUpdate = { title: 'New Title' };
      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: titleOnlyUpdate,
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
      expect(mockActivitiesService.logCaseUpdated).toHaveBeenCalledWith(
        CASE_ID,
        'Updated: title',
        ATTORNEY_ID
      );
      expect(mockActivitiesService.logStatusChanged).not.toHaveBeenCalled();
    });

    it('should return 403 for client trying to update', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: updateData,
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: updateData,
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid update data', async () => {
      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: { title: '' }, // empty string should fail validation
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/cases/[id]', () => {
    it('should delete case for attorney owner', async () => {
      const { DELETE } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.message).toBe('Case deleted successfully');
      expect(mockCasesService.deleteCase).toHaveBeenCalledWith(CASE_ID);
    });

    it('should return 403 for client trying to delete', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { DELETE } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { DELETE } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent case', async () => {
      mockCasesService.getCase.mockResolvedValueOnce(null);

      const { DELETE } = await import('./[id]/route');
      const request = createMockRequest('http://localhost:3000/api/cases/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/cases/[id]/documents', () => {
    it('should return documents for case attorney', async () => {
      const { GET } = await import('./[id]/documents/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/documents`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(DOCUMENT_ID);
    });

    it('should return documents for case client', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { GET } = await import('./[id]/documents/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/documents`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { GET } = await import('./[id]/documents/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/documents`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized user', async () => {
      setCurrentUser(mockUnauthorizedUser, { ...mockClientProfile, id: UNAUTHORIZED_USER_ID });

      const { GET } = await import('./[id]/documents/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/documents`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/cases/[id]/documents', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { POST } = await import('./[id]/documents/route');

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf');
      formData.append('document_type', 'passport');

      const request = createMockFormDataRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/documents`,
        formData
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized user', async () => {
      setCurrentUser(mockUnauthorizedUser, { ...mockClientProfile, id: UNAUTHORIZED_USER_ID });

      const { POST } = await import('./[id]/documents/route');

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf');
      formData.append('document_type', 'passport');

      const request = createMockFormDataRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/documents`,
        formData
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 400 when file is missing', async () => {
      const { POST } = await import('./[id]/documents/route');

      const formData = new FormData();
      formData.append('document_type', 'passport');

      const request = createMockFormDataRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/documents`,
        formData
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('File is required');
    });

    it('should return 400 when document_type is missing', async () => {
      const { POST } = await import('./[id]/documents/route');

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }), 'test.pdf');

      const request = createMockFormDataRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/documents`,
        formData
      );

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document type is required');
    });
  });

  describe('GET /api/cases/[id]/forms', () => {
    it('should return forms for case attorney', async () => {
      const { GET } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe(FORM_ID);
    });

    it('should return forms for case client', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { GET } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { GET } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized user', async () => {
      setCurrentUser(mockUnauthorizedUser, { ...mockClientProfile, id: UNAUTHORIZED_USER_ID });

      const { GET } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/cases/[id]/forms', () => {
    const validFormData = {
      form_type: 'I-129',
      form_data: { field1: 'value1' },
    };

    it('should create form for case attorney', async () => {
      const { POST } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`, {
        method: 'POST',
        body: validFormData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.id).toBe(FORM_ID);
      expect(mockFormsService.createForm).toHaveBeenCalledWith({
        case_id: CASE_ID,
        form_type: 'I-129',
        form_data: { field1: 'value1' },
      });
      expect(mockActivitiesService.logFormCreated).toHaveBeenCalledWith(
        CASE_ID,
        'I-129',
        FORM_ID,
        ATTORNEY_ID
      );
    });

    it('should return 403 when client tries to create form', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { POST } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`, {
        method: 'POST',
        body: validFormData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { POST } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`, {
        method: 'POST',
        body: validFormData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized user', async () => {
      setCurrentUser(mockUnauthorizedUser, { ...mockClientProfile, id: UNAUTHORIZED_USER_ID });

      const { POST } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`, {
        method: 'POST',
        body: validFormData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid form data', async () => {
      const { POST } = await import('./[id]/forms/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/forms`, {
        method: 'POST',
        body: { form_data: {} }, // missing form_type
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/cases/stats', () => {
    it('should return stats for attorney', async () => {
      const { GET } = await import('./stats/route');
      const request = createMockRequest('http://localhost:3000/api/cases/stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(10);
      expect(data.byStatus).toBeDefined();
      expect(data.pendingDeadlines).toBe(2);
    });

    it('should return stats for admin', async () => {
      setCurrentUser({ ...mockAttorneyUser, id: ADMIN_ID }, mockAdminProfile);

      const { GET } = await import('./stats/route');
      const request = createMockRequest('http://localhost:3000/api/cases/stats');

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null, null);

      const { GET } = await import('./stats/route');
      const request = createMockRequest('http://localhost:3000/api/cases/stats');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for client', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      const { GET } = await import('./stats/route');
      const request = createMockRequest('http://localhost:3000/api/cases/stats');

      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully in GET /api/cases', async () => {
      mockCasesService.getCases.mockRejectedValueOnce(new Error('Database error'));

      const { GET } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases');

      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should handle service errors gracefully in POST /api/cases', async () => {
      mockCasesService.createCase.mockRejectedValueOnce(new Error('Database error'));

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases', {
        method: 'POST',
        body: {
          client_id: CLIENT_ID,
          visa_type: 'H1B',
          title: 'Test Case',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle service errors gracefully in PATCH /api/cases/[id]', async () => {
      mockCasesService.updateCase.mockRejectedValueOnce(new Error('Database error'));

      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: { title: 'Updated' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });

    it('should handle service errors gracefully in DELETE /api/cases/[id]', async () => {
      mockCasesService.deleteCase.mockRejectedValueOnce(new Error('Database error'));

      const { DELETE } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });

    it('should handle service errors gracefully in GET /api/cases/stats', async () => {
      mockCasesService.getCaseStats.mockRejectedValueOnce(new Error('Database error'));

      const { GET } = await import('./stats/route');
      const request = createMockRequest('http://localhost:3000/api/cases/stats');

      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Authorization Edge Cases', () => {
    it('should allow attorney to access their own cases even when filtering by client', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases?client_id=${CLIENT_ID}`
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should correctly identify attorney as case owner', async () => {
      // Verify the attorney can modify/delete
      const { PATCH } = await import('./[id]/route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: { title: 'Attorney Update' },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
    });

    it('should correctly identify client as non-owner (read-only)', async () => {
      setCurrentUser(mockClientUser, mockClientProfile);

      // Client can read
      const { GET } = await import('./[id]/route');
      const getRequest = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`);
      const getResponse = await GET(getRequest, { params: Promise.resolve({ id: CASE_ID }) });
      expect(getResponse.status).toBe(200);

      // But cannot modify
      const { PATCH } = await import('./[id]/route');
      const patchRequest = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}`, {
        method: 'PATCH',
        body: { title: 'Client Update' },
      });
      const patchResponse = await PATCH(patchRequest, { params: Promise.resolve({ id: CASE_ID }) });
      expect(patchResponse.status).toBe(403);
    });
  });
});
