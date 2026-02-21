/**
 * Integration tests for Chat API routes.
 *
 * Tests cover:
 * - POST /api/chat - Send message and get streaming AI response
 * - GET  /api/chat - List conversations
 * - GET  /api/chat/[conversationId] - Get conversation messages
 * - PATCH /api/chat/[conversationId] - Update conversation title
 * - DELETE /api/chat/[conversationId] - Delete conversation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const MOCK_USER_ID = 'user-123';
const MOCK_EMAIL = 'test@example.com';
const MOCK_CONV_ID = '550e8400-e29b-41d4-a716-446655440001';
const MOCK_CASE_ID = '550e8400-e29b-41d4-a716-446655440002';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  createRateLimiter: vi.fn(),
  RATE_LIMITS: {
    AI_CHAT: { maxRequests: 50, windowMs: 3600_000, keyPrefix: 'ai:chat' },
    STANDARD: { maxRequests: 100, windowMs: 60_000, keyPrefix: 'standard' },
    SENSITIVE: { maxRequests: 20, windowMs: 60_000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: { limit: vi.fn() },
  sensitiveRateLimiter: { limit: vi.fn() },
}));

vi.mock('@/lib/ai/chat', () => ({
  streamChatResponse: vi.fn(),
  generateConversationTitle: vi.fn(),
}));

vi.mock('@/lib/db/conversations', () => ({
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  getConversationMessages: vi.fn(),
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
}));

vi.mock('@/lib/api/sse', () => ({
  createSSEStream: vi.fn(),
  SSE_CONFIG: {
    VERCEL_FREE_KEEPALIVE_MS: 15_000,
  },
}));

vi.mock('@/lib/billing/quota', () => {
  class QuotaExceededError extends Error {
    constructor(
      public metric: string,
      public limit: number,
      public current: number
    ) {
      super(`Quota exceeded for ${metric}: ${current}/${limit}`);
      this.name = 'QuotaExceededError';
    }
  }
  return {
    enforceQuota: vi.fn(),
    trackUsage: vi.fn(),
    QuotaExceededError,
  };
});

vi.mock('@/lib/audit/ai-audit', () => ({
  logAIRequest: vi.fn(),
}));

// Use importOriginal to keep withAuth, successResponse, errorResponse
// while still allowing individual mocking of requireAiConsent and safeParseBody
vi.mock('@/lib/auth/api-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/api-helpers')>();
  return {
    ...actual,
    requireAiConsent: vi.fn().mockResolvedValue(null),
  };
});

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

import { createClient } from '@/lib/supabase/server';
import { getProfileAsAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import {
  createConversation,
  getConversation,
  getConversationMessages,
  addMessage,
  deleteConversation,
  updateConversationTitle,
} from '@/lib/db/conversations';
import { createSSEStream } from '@/lib/api/sse';
import { enforceQuota, QuotaExceededError } from '@/lib/billing/quota';

import { requireAiConsent } from '@/lib/auth/api-helpers';
import { POST as chatPOST, GET as chatGET } from './route';
import {
  GET as convGET,
  PATCH as convPATCH,
  DELETE as convDELETE,
} from './[conversationId]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  const req = new NextRequest(`http://localhost:3000${url}`, init);
  if (body) {
    Object.defineProperty(req, 'json', {
      value: async () => body,
      configurable: true,
    });
  }
  return req;
}

function mockSupabaseAuth(user: { id: string; email: string } | null) {
  const mockFrom = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('Not authenticated'),
      }),
    },
    from: vi.fn().mockReturnValue(mockFrom),
  };
  vi.mocked(createClient).mockResolvedValue(mock as any);
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Chat API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rateLimit allows requests (withAuth calls rateLimit internally)
    vi.mocked(rateLimit).mockResolvedValue({ success: true });

    // Default: getProfileAsAdmin returns a valid profile
    vi.mocked(getProfileAsAdmin).mockResolvedValue({
      profile: { id: MOCK_USER_ID, role: 'attorney', full_name: 'Test User', email: MOCK_EMAIL },
      error: null,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // POST /api/chat
  // =========================================================================
  describe('POST /api/chat', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabaseAuth(null);

      const req = createRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 when AI consent not granted', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(requireAiConsent).mockResolvedValueOnce(
        NextResponse.json({ error: 'AI consent required' }, { status: 403 })
      );

      const req = createRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('AI consent required');
    });

    it('returns 429 when rate limited', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(rateLimit).mockResolvedValue({ success: false, retryAfter: 60 });

      const req = createRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      const res = await chatPOST(req);

      expect(res.status).toBe(429);
    });

    it('returns 402 when quota exceeded', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockRejectedValue(
        new QuotaExceededError('ai_requests', 25, 25)
      );

      const req = createRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(402);
      expect(data.error).toBe('AI request limit reached. Please upgrade your plan.');
      expect(data.code).toBe('QUOTA_EXCEEDED');
    });

    it('returns 400 for empty message', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const req = createRequest('POST', '/api/chat', {
        message: '',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Bad Request');
    });

    it('returns 400 for message exceeding max length', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const req = createRequest('POST', '/api/chat', {
        message: 'x'.repeat(4001),
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Bad Request');
    });

    it('returns 400 for invalid conversationId (not UUID)', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const req = createRequest('POST', '/api/chat', {
        conversationId: 'not-a-uuid',
        message: 'Hello',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Bad Request');
    });

    it('returns 400 when trimmed message is empty (whitespace only)', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const req = createRequest('POST', '/api/chat', {
        message: '   ',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Bad Request');
      expect(data.message).toBe('Message cannot be empty');
    });

    it('returns 404 when conversationId does not exist', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);
      vi.mocked(getConversation).mockResolvedValue(null);

      const req = createRequest('POST', '/api/chat', {
        conversationId: MOCK_CONV_ID,
        message: 'Hello',
      });
      const res = await chatPOST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('Not Found');
      expect(data.message).toBe('Conversation not found');
    });

    it('creates new conversation when no conversationId provided', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const mockConv = {
        id: MOCK_CONV_ID,
        userId: MOCK_USER_ID,
        caseId: undefined,
        title: 'New Conversation',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      vi.mocked(createConversation).mockResolvedValue(mockConv);
      vi.mocked(getConversationMessages).mockResolvedValue([]);
      vi.mocked(addMessage).mockResolvedValue({
        id: 'msg-1',
        conversationId: MOCK_CONV_ID,
        role: 'assistant',
        content: '',
        createdAt: '2024-01-01',
      } as any);

      // Mock createSSEStream to execute handler and return Response
      vi.mocked(createSSEStream).mockImplementation((handler: any) => {
        const mockSSE = { send: vi.fn(), error: vi.fn() };
        handler(mockSSE);
        return new Response('SSE stream', { status: 200 });
      });

      const req = createRequest('POST', '/api/chat', {
        message: 'Hello',
      });
      const res = await chatPOST(req);

      expect(res.status).toBe(200);
      expect(createConversation).toHaveBeenCalledWith(MOCK_USER_ID, undefined);
    });

    it('continues existing conversation when conversationId provided', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(enforceQuota).mockResolvedValue(undefined);

      const mockConv = {
        id: MOCK_CONV_ID,
        userId: MOCK_USER_ID,
        caseId: MOCK_CASE_ID,
        title: 'Existing Conversation',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      vi.mocked(getConversation).mockResolvedValue(mockConv);
      vi.mocked(getConversationMessages).mockResolvedValue([]);
      vi.mocked(addMessage).mockResolvedValue({
        id: 'msg-1',
        conversationId: MOCK_CONV_ID,
        role: 'assistant',
        content: '',
        createdAt: '2024-01-01',
      } as any);

      vi.mocked(createSSEStream).mockImplementation((handler: any) => {
        const mockSSE = { send: vi.fn(), error: vi.fn() };
        handler(mockSSE);
        return new Response('SSE stream', { status: 200 });
      });

      const req = createRequest('POST', '/api/chat', {
        conversationId: MOCK_CONV_ID,
        message: 'Follow up',
      });
      const res = await chatPOST(req);

      expect(res.status).toBe(200);
      expect(getConversation).toHaveBeenCalledWith(MOCK_CONV_ID, MOCK_USER_ID);
      expect(createConversation).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET /api/chat
  // =========================================================================
  describe('GET /api/chat', () => {
    it('returns 401 when not authenticated', async () => {
      mockSupabaseAuth(null);

      const req = createRequest('GET', '/api/chat');
      const res = await chatGET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 200 with conversations list', async () => {
      const mockConversations = [
        {
          id: MOCK_CONV_ID,
          case_id: null,
          title: 'Test Conversation',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockConversations,
          error: null,
        }),
      };
      const mock = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: MOCK_USER_ID, email: MOCK_EMAIL } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockFrom),
      };
      vi.mocked(createClient).mockResolvedValue(mock as any);

      const req = createRequest('GET', '/api/chat');
      const res = await chatGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // successResponse wraps in { success: true, data: { conversations: [...] } }
      expect(data.data.conversations).toHaveLength(1);
      expect(data.data.conversations[0].id).toBe(MOCK_CONV_ID);
      expect(data.data.conversations[0].title).toBe('Test Conversation');
    });

    it('filters by caseId query param', async () => {
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      const mock = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: MOCK_USER_ID, email: MOCK_EMAIL } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockFrom),
      };
      vi.mocked(createClient).mockResolvedValue(mock as any);

      const req = createRequest('GET', `/api/chat?caseId=${MOCK_CASE_ID}`);
      const res = await chatGET(req);
      await res.json();

      expect(res.status).toBe(200);
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
      expect(mockFrom.eq).toHaveBeenCalledWith('case_id', MOCK_CASE_ID);
    });

    it('clamps limit to 1-100', async () => {
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };
      const mock = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: MOCK_USER_ID, email: MOCK_EMAIL } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockFrom),
      };
      vi.mocked(createClient).mockResolvedValue(mock as any);

      const req = createRequest('GET', '/api/chat?limit=500');
      const res = await chatGET(req);

      expect(res.status).toBe(200);
      expect(mockFrom.limit).toHaveBeenCalledWith(100);
    });

    it('returns 500 on database error', async () => {
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection lost' },
        }),
      };
      const mock = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: MOCK_USER_ID, email: MOCK_EMAIL } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue(mockFrom),
      };
      vi.mocked(createClient).mockResolvedValue(mock as any);

      const req = createRequest('GET', '/api/chat');
      const res = await chatGET(req);
      const data = await res.json();

      // withAuth catches thrown errors and returns errorResponse('Internal server error', 500)
      expect(res.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  // =========================================================================
  // GET /api/chat/[conversationId]
  // =========================================================================
  describe('GET /api/chat/[conversationId]', () => {
    const routeParams = { params: Promise.resolve({ conversationId: MOCK_CONV_ID }) };

    it('returns 401 when not authenticated', async () => {
      mockSupabaseAuth(null);

      const req = createRequest('GET', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convGET(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns conversation messages', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });

      const mockConv = {
        id: MOCK_CONV_ID,
        userId: MOCK_USER_ID,
        caseId: MOCK_CASE_ID,
        title: 'Test Chat',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          createdAt: '2024-01-01T00:00:01Z',
        },
      ];

      vi.mocked(getConversation).mockResolvedValue(mockConv as any);
      vi.mocked(getConversationMessages).mockResolvedValue(mockMessages as any);

      const req = createRequest('GET', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convGET(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(200);
      // successResponse wraps in { success: true, data: { conversation, messages } }
      expect(data.data.conversation.id).toBe(MOCK_CONV_ID);
      expect(data.data.conversation.title).toBe('Test Chat');
      expect(data.data.messages).toHaveLength(2);
    });

    it('returns 404 when conversation not found', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(getConversation).mockResolvedValue(null);

      const req = createRequest('GET', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convGET(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(404);
      // errorResponse('Conversation not found', 404) -> { success: false, error: 'Conversation not found' }
      expect(data.error).toBe('Conversation not found');
    });

    it('returns 500 on error', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(getConversation).mockRejectedValue(new Error('DB error'));

      const req = createRequest('GET', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convGET(req, routeParams);
      const data = await res.json();

      // withAuth catches thrown errors and returns errorResponse('Internal server error', 500)
      expect(res.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  // =========================================================================
  // PATCH /api/chat/[conversationId]
  // =========================================================================
  describe('PATCH /api/chat/[conversationId]', () => {
    const routeParams = { params: Promise.resolve({ conversationId: MOCK_CONV_ID }) };

    it('returns 401 when not authenticated', async () => {
      mockSupabaseAuth(null);

      const req = createRequest('PATCH', `/api/chat/${MOCK_CONV_ID}`, {
        title: 'New Title',
      });
      const res = await convPATCH(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('updates conversation title', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });

      vi.mocked(updateConversationTitle).mockResolvedValue(undefined);
      vi.mocked(getConversation).mockResolvedValue({
        id: MOCK_CONV_ID,
        userId: MOCK_USER_ID,
        caseId: null,
        title: 'Updated Title',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:01Z',
      } as any);

      const req = createRequest('PATCH', `/api/chat/${MOCK_CONV_ID}`, {
        title: 'Updated Title',
      });
      const res = await convPATCH(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(200);
      // successResponse wraps in { success: true, data: { conversation } }
      expect(data.data.conversation.title).toBe('Updated Title');
      expect(updateConversationTitle).toHaveBeenCalledWith(
        MOCK_CONV_ID,
        MOCK_USER_ID,
        'Updated Title'
      );
    });

    it('returns 404 when conversation not found', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(getConversation).mockResolvedValue(null);

      const req = createRequest('PATCH', `/api/chat/${MOCK_CONV_ID}`, {
        title: 'Updated Title',
      });
      const res = await convPATCH(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('Conversation not found');
    });

    it('returns 500 on error', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(getConversation).mockRejectedValue(new Error('DB error'));

      const req = createRequest('PATCH', `/api/chat/${MOCK_CONV_ID}`, {
        title: 'Updated Title',
      });
      const res = await convPATCH(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  // =========================================================================
  // DELETE /api/chat/[conversationId]
  // =========================================================================
  describe('DELETE /api/chat/[conversationId]', () => {
    const routeParams = { params: Promise.resolve({ conversationId: MOCK_CONV_ID }) };

    it('returns 401 when not authenticated', async () => {
      mockSupabaseAuth(null);

      const req = createRequest('DELETE', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convDELETE(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('deletes conversation successfully', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(deleteConversation).mockResolvedValue(undefined);

      const req = createRequest('DELETE', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convDELETE(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // successResponse wraps: { success: true, data: { deleted: true } }
      expect(data.data.deleted).toBe(true);
      expect(deleteConversation).toHaveBeenCalledWith(MOCK_CONV_ID, MOCK_USER_ID);
    });

    it('returns 500 on error', async () => {
      mockSupabaseAuth({ id: MOCK_USER_ID, email: MOCK_EMAIL });
      vi.mocked(deleteConversation).mockRejectedValue(new Error('DB error'));

      const req = createRequest('DELETE', `/api/chat/${MOCK_CONV_ID}`);
      const res = await convDELETE(req, routeParams);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
