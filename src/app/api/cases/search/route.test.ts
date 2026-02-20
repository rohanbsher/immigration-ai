import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';

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

// Mock natural language search
vi.mock('@/lib/ai/natural-search', () => ({
  naturalLanguageSearch: vi.fn().mockResolvedValue({
    interpretation: {
      understood: 'H-1B cases',
      filters: { visaType: ['H1B'] },
      confidence: 0.9,
    },
    results: [{ id: 'case-1', title: 'H1B Case' }],
    totalCount: 1,
    suggestions: [],
  }),
}));

const mockSearchResponse = {
  interpretation: {
    understood: 'H-1B cases',
    filters: { visaType: ['H1B'] },
    confidence: 0.9,
  },
  results: [{ id: 'case-1', title: 'H1B Case' }],
  totalCount: 1,
  suggestions: [],
};

// Mock AI audit
vi.mock('@/lib/audit/ai-audit', () => ({
  logAIRequest: vi.fn(),
}));

// Mock billing quota
vi.mock('@/lib/billing/quota', () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock AI client
vi.mock('@/lib/ai/client', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
}));

// Mock rate limiting
const mockRateLimiter = {
  limit: vi.fn().mockResolvedValue({ allowed: true }),
  check: vi.fn().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() }),
  getHeaders: vi.fn().mockReturnValue({}),
};

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AI_SEARCH: { maxRequests: 20, windowMs: 60000, keyPrefix: 'ai-search' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  createRateLimiter: vi.fn().mockReturnValue(mockRateLimiter),
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

import { naturalLanguageSearch } from '@/lib/ai/natural-search';
import { logAIRequest } from '@/lib/audit/ai-audit';
import { trackUsage } from '@/lib/billing/quota';

function createMockRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  const { method = 'POST', body } = options;
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

describe('Cases Search API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser({ id: ATTORNEY_ID, email: 'attorney@example.com' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/cases/search', () => {
    it('should return 401 for unauthenticated user', async () => {
      setCurrentUser(null);

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'H1B cases' },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      mockRateLimiter.limit.mockResolvedValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      });

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'H1B cases' },
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
    });

    it('should return 400 when query is missing', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Query is required');
    });

    it('should return 400 when query is too short', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'a' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Query must be at least 2 characters');
    });

    it('should return 400 when query is only whitespace resulting in < 2 chars', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: '   ' },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 200 with search results', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'H1B cases with missing passport' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.interpretation).toBeDefined();
      expect(data.results).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(naturalLanguageSearch).toHaveBeenCalledWith(
        'H1B cases with missing passport',
        ATTORNEY_ID
      );
    });

    it('should log AI request when confidence > 0.3', async () => {
      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'H1B cases' },
      });

      await POST(request);

      expect(logAIRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'natural_search',
          provider: 'anthropic',
          userId: ATTORNEY_ID,
          dataFieldsSent: ['query'],
        })
      );
      expect(trackUsage).toHaveBeenCalledWith(ATTORNEY_ID, 'ai_requests');
    });

    it('should not log AI request when confidence <= 0.3', async () => {
      vi.mocked(naturalLanguageSearch).mockResolvedValueOnce({
        ...mockSearchResponse,
        interpretation: { ...mockSearchResponse.interpretation, confidence: 0.2 },
      });

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'test query' },
      });

      await POST(request);

      expect(logAIRequest).not.toHaveBeenCalled();
      expect(trackUsage).not.toHaveBeenCalled();
    });

    it('should truncate query to 500 characters', async () => {
      const longQuery = 'a'.repeat(600);

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: longQuery },
      });

      await POST(request);

      expect(naturalLanguageSearch).toHaveBeenCalledWith(
        'a'.repeat(500),
        ATTORNEY_ID
      );
    });

    it('should handle search service errors gracefully', async () => {
      vi.mocked(naturalLanguageSearch).mockRejectedValueOnce(new Error('AI service error'));

      const { POST } = await import('./route');
      const request = createMockRequest('http://localhost:3000/api/cases/search', {
        body: { query: 'test query' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
