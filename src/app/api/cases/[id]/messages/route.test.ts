import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// UUID constants
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440001';
const CASE_ID = '550e8400-e29b-41d4-a716-446655440003';
const UNAUTHORIZED_USER_ID = '550e8400-e29b-41d4-a716-446655440099';
const MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440010';

const mockCase = {
  id: CASE_ID,
  attorney_id: ATTORNEY_ID,
  client_id: CLIENT_ID,
  visa_type: 'H1B',
  status: 'intake',
  title: 'H1B Application',
};

const mockMessage = {
  id: MESSAGE_ID,
  case_id: CASE_ID,
  sender_id: ATTORNEY_ID,
  content: 'Hello, please upload your passport.',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock Supabase user
let mockSupabaseUser: { id: string; email: string } | null = {
  id: ATTORNEY_ID,
  email: 'attorney@example.com',
};

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: { user: mockSupabaseUser }, error: null })
    ),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock db services
const mockCaseMessagesService = {
  getMessages: vi.fn().mockResolvedValue({ data: [mockMessage], total: 1 }),
  markAllAsRead: vi.fn().mockResolvedValue(undefined),
  createMessage: vi.fn().mockResolvedValue(mockMessage),
};

const mockCasesService = {
  getCase: vi.fn().mockResolvedValue(mockCase),
};

vi.mock('@/lib/db', () => ({
  caseMessagesService: mockCaseMessagesService,
  casesService: mockCasesService,
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

// Mock email notifications
vi.mock('@/lib/email/notifications', () => ({
  sendCaseUpdateEmail: vi.fn().mockResolvedValue(undefined),
}));

// Import the rate limiter to manipulate in tests
import { standardRateLimiter } from '@/lib/rate-limit';

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

function setCurrentUser(user: { id: string; email: string } | null) {
  mockSupabaseUser = user;
}

describe('Cases Messages API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ id: ATTORNEY_ID, email: 'attorney@example.com' });
    mockCasesService.getCase.mockResolvedValue(mockCase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/cases/[id]/messages', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user has no case access', async () => {
      setCurrentUser({ id: UNAUTHORIZED_USER_ID, email: 'other@example.com' });

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 403 when case does not exist', async () => {
      mockCasesService.getCase.mockResolvedValueOnce(null);

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 200 with messages for attorney', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.limit).toBe(50);
      expect(data.offset).toBe(0);
    });

    it('should return 200 with messages for client', async () => {
      setCurrentUser({ id: CLIENT_ID, email: 'client@example.com' });

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(200);
    });

    it('should respect pagination params', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/messages?limit=10&offset=5`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockCaseMessagesService.getMessages).toHaveBeenCalledWith(CASE_ID, {
        limit: 10,
        offset: 5,
      });
    });

    it('should clamp limit to max 100', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${CASE_ID}/messages?limit=200`
      );

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockCaseMessagesService.getMessages).toHaveBeenCalledWith(CASE_ID, {
        limit: 100,
        offset: 0,
      });
    });

    it('should call markAllAsRead for the current user', async () => {
      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(mockCaseMessagesService.markAllAsRead).toHaveBeenCalledWith(CASE_ID, ATTORNEY_ID);
    });

    it('should return rate limit response when rate limited', async () => {
      vi.mocked(standardRateLimiter.limit).mockResolvedValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as any);

      const { GET } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`);

      const response = await GET(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(429);
    });
  });

  describe('POST /api/cases/[id]/messages', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Hello' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user has no case access', async () => {
      setCurrentUser({ id: UNAUTHORIZED_USER_ID, email: 'other@example.com' });

      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Hello' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(403);
    });

    it('should return 400 for empty content', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: '' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for content exceeding max length', async () => {
      const { POST } = await import('./route');
      const longContent = 'a'.repeat(10001);
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: longContent },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 201 and create message for attorney', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Hello, please upload your passport.' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe(MESSAGE_ID);
      expect(mockCaseMessagesService.createMessage).toHaveBeenCalledWith({
        case_id: CASE_ID,
        sender_id: ATTORNEY_ID,
        content: 'Hello, please upload your passport.',
      });
    });

    it('should return 201 for client sending message', async () => {
      setCurrentUser({ id: CLIENT_ID, email: 'client@example.com' });

      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Here is my passport.' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(201);
      expect(mockCaseMessagesService.createMessage).toHaveBeenCalledWith({
        case_id: CASE_ID,
        sender_id: CLIENT_ID,
        content: 'Here is my passport.',
      });
    });

    it('should fire email notification (fire-and-forget)', async () => {
      const { sendCaseUpdateEmail } = await import('@/lib/email/notifications');

      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Test message' },
      });

      await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(sendCaseUpdateEmail).toHaveBeenCalledWith(
        CASE_ID,
        'note_added',
        'New message received',
        ATTORNEY_ID
      );
    });

    it('should handle service errors gracefully', async () => {
      mockCaseMessagesService.createMessage.mockRejectedValueOnce(new Error('DB error'));

      const { POST } = await import('./route');
      const request = createMockRequest(`http://localhost:3000/api/cases/${CASE_ID}/messages`, {
        method: 'POST',
        body: { content: 'Test message' },
      });

      const response = await POST(request, { params: Promise.resolve({ id: CASE_ID }) });

      expect(response.status).toBe(500);
    });
  });
});
