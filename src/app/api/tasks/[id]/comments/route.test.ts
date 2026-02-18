import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUserId = 'user-123';
const mockTaskId = 'task-abc';

const mockTask = {
  id: mockTaskId,
  title: 'Test task',
  status: 'pending',
  created_by: mockUserId,
  assigned_to: null,
};

const mockComment = {
  id: 'comment-1',
  task_id: mockTaskId,
  user_id: mockUserId,
  content: 'Test comment',
  created_at: '2026-01-01T00:00:00Z',
  user: { id: mockUserId, first_name: 'Test', last_name: 'User', avatar_url: null },
};

// ---------------------------------------------------------------------------
// Mock supabase
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock db services
// ---------------------------------------------------------------------------

vi.mock('@/lib/db', () => ({
  tasksService: {
    getTask: vi.fn(),
    getComments: vi.fn(),
    addComment: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock auth helpers
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-helpers', () => {
  const authenticateFn = vi.fn();

  const withAuth = (handler: any) => {
    return async (request: any, context: any) => {
      const auth = await authenticateFn(request);
      if (!auth.success) {
        return auth.response;
      }
      try {
        return await handler(request, context, auth);
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextResponse } = require('next/server');
  return {
    authenticate: authenticateFn,
    withAuth,
    withAttorneyAuth: (handler: any) => withAuth(handler),
    withAdminAuth: (handler: any) => withAuth(handler),
    errorResponse: (error: string, status: number) =>
      new Response(JSON.stringify({ success: false, error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    successResponse: (data: any, status = 200) =>
      new Response(JSON.stringify({ success: true, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    safeParseBody: async (request: any) => {
      try {
        const data = await request.json();
        return { success: true, data };
      } catch {
        return {
          success: false,
          response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
        };
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Mock rate limiter & logger
// ---------------------------------------------------------------------------

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
  },
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

import { GET, POST } from './route';
import { tasksService } from '@/lib/db';
import { authenticate } from '@/lib/auth/api-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(method: string, url: string, body?: Record<string, unknown>): NextRequest {
  const init: RequestInit = {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' }),
  };
  if (body) init.body = JSON.stringify(body);
  return new NextRequest(`http://localhost:3000${url}`, init);
}

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockAuth() {
  vi.mocked(authenticate).mockResolvedValue({
    success: true,
    user: { id: mockUserId } as any,
    profile: { id: mockUserId, role: 'attorney', email: 'test@example.com' } as any,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Task Comments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    // Default: task exists and is visible to the user
    vi.mocked(tasksService.getTask).mockResolvedValue(mockTask as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/tasks/[id]/comments', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(authenticate).mockResolvedValue({
        success: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        error: 'Unauthorized',
      } as any);

      const req = createRequest('GET', `/api/tasks/${mockTaskId}/comments`);
      const res = await GET(req, createContext(mockTaskId));

      expect(res.status).toBe(401);
    });

    it('returns comments for a task', async () => {
      vi.mocked(tasksService.getComments).mockResolvedValue([mockComment] as any);

      const req = createRequest('GET', `/api/tasks/${mockTaskId}/comments`);
      const res = await GET(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].content).toBe('Test comment');
    });

    it('returns empty array when no comments exist', async () => {
      vi.mocked(tasksService.getComments).mockResolvedValue([]);

      const req = createRequest('GET', `/api/tasks/${mockTaskId}/comments`);
      const res = await GET(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(0);
    });

    it('returns 500 when service throws', async () => {
      vi.mocked(tasksService.getComments).mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET', `/api/tasks/${mockTaskId}/comments`);
      const res = await GET(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to get comments');
    });

    it('returns 404 when task does not exist or user cannot access it', async () => {
      vi.mocked(tasksService.getTask).mockResolvedValue(null);

      const req = createRequest('GET', `/api/tasks/${mockTaskId}/comments`);
      const res = await GET(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Task not found');
      expect(tasksService.getComments).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/tasks/[id]/comments', () => {
    it('creates a comment', async () => {
      vi.mocked(tasksService.addComment).mockResolvedValue(mockComment as any);

      const req = createRequest('POST', `/api/tasks/${mockTaskId}/comments`, { content: 'New comment' });
      const res = await POST(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(tasksService.addComment).toHaveBeenCalledWith(mockTaskId, mockUserId, 'New comment');
    });

    it('rejects empty content', async () => {
      const req = createRequest('POST', `/api/tasks/${mockTaskId}/comments`, { content: '' });
      const res = await POST(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it('returns 500 when service throws', async () => {
      vi.mocked(tasksService.addComment).mockRejectedValue(new Error('DB error'));

      const req = createRequest('POST', `/api/tasks/${mockTaskId}/comments`, { content: 'Test' });
      const res = await POST(req, createContext(mockTaskId));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to create comment');
    });
  });
});
