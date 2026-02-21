import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// UUID constants
const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000';
const ALERT_ID = '550e8400-e29b-41d4-a716-446655440010';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn(),
}));

// Mock deadline functions
const mockAcknowledgeAlert = vi.fn();
const mockSnoozeAlert = vi.fn();
vi.mock('@/lib/deadline', () => ({
  acknowledgeAlert: (...args: unknown[]) => mockAcknowledgeAlert(...args),
  snoozeAlert: (...args: unknown[]) => mockSnoozeAlert(...args),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000, keyPrefix: 'standard' },
    AUTH: { maxRequests: 5, windowMs: 60000, keyPrefix: 'auth' },
    AI: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai' },
    AI_COMPLETENESS: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-completeness' },
    AI_SUCCESS_SCORE: { maxRequests: 10, windowMs: 3600000, keyPrefix: 'ai-success-score' },
    SENSITIVE: { maxRequests: 20, windowMs: 60000, keyPrefix: 'sensitive' },
  },
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  aiRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  authRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  sensitiveRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
  createRateLimiter: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({ allowed: true }),
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

import { getProfileAsAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

function createMockRequest(
  url: string,
  body?: Record<string, unknown>
): NextRequest {
  const requestInit: RequestInit = {
    method: 'PATCH',
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

function setAuthenticatedUser(userId: string) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: `${userId}@example.com` } },
    error: null,
  });
  vi.mocked(getProfileAsAdmin).mockResolvedValue({
    profile: { id: userId, role: 'attorney', full_name: 'Test User', email: `${userId}@example.com` },
    error: null,
  } as any);
}

function setUnauthenticated() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  });
}

describe('PATCH /api/cases/deadlines/[alertId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticatedUser(ATTORNEY_ID);
    vi.mocked(rateLimit).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated user', async () => {
    setUnauthenticated();

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'acknowledge' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid action', async () => {
    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'invalid-action' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('acknowledge');
  });

  it('should return 400 when action is missing', async () => {
    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { snoozeDays: 5 }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(400);
  });

  it('should return 404 when alert is not found on acknowledge', async () => {
    mockAcknowledgeAlert.mockResolvedValue(false);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'acknowledge' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return 200 on successful acknowledge', async () => {
    mockAcknowledgeAlert.mockResolvedValue(true);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'acknowledge' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    // successResponse wraps in { success, data }
    expect(json.success).toBe(true);
    expect(json.data.action).toBe('acknowledge');
    expect(json.data.alertId).toBe(ALERT_ID);
    expect(mockAcknowledgeAlert).toHaveBeenCalledWith(ALERT_ID, ATTORNEY_ID);
  });

  it('should return 200 on successful snooze with default 1 day', async () => {
    mockSnoozeAlert.mockResolvedValue(true);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'snooze' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.action).toBe('snooze');
    expect(mockSnoozeAlert).toHaveBeenCalledWith(ALERT_ID, ATTORNEY_ID, 1);
  });

  it('should return 200 on snooze with custom days', async () => {
    mockSnoozeAlert.mockResolvedValue(true);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'snooze', snoozeDays: 7 }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(200);
    expect(mockSnoozeAlert).toHaveBeenCalledWith(ALERT_ID, ATTORNEY_ID, 7);
  });

  it('should clamp snooze days to minimum of 1', async () => {
    mockSnoozeAlert.mockResolvedValue(true);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'snooze', snoozeDays: -5 }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(200);
    expect(mockSnoozeAlert).toHaveBeenCalledWith(ALERT_ID, ATTORNEY_ID, 1);
  });

  it('should clamp snooze days to maximum of 30', async () => {
    mockSnoozeAlert.mockResolvedValue(true);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'snooze', snoozeDays: 100 }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(200);
    expect(mockSnoozeAlert).toHaveBeenCalledWith(ALERT_ID, ATTORNEY_ID, 30);
  });

  it('should return 404 when snooze fails (alert not found)', async () => {
    mockSnoozeAlert.mockResolvedValue(false);

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'snooze', snoozeDays: 3 }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return 500 on unexpected error', async () => {
    mockAcknowledgeAlert.mockRejectedValue(new Error('Database error'));

    const { PATCH } = await import('./route');
    const request = createMockRequest(
      `http://localhost:3000/api/cases/deadlines/${ALERT_ID}`,
      { action: 'acknowledge' }
    );
    const response = await PATCH(request, { params: Promise.resolve({ alertId: ALERT_ID }) });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
