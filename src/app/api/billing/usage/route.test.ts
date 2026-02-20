/**
 * Integration tests for Billing Usage API route.
 *
 * Tests cover:
 * - GET /api/billing/usage - Fetch current usage metrics
 * - Authentication (401 unauthorized)
 * - Rate limiting (429 too many requests)
 * - Response shape validation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockUserId = 'user-123';

const mockQuotaResponse = {
  allowed: true,
  current: 5,
  limit: 10,
  remaining: 5,
  isUnlimited: false,
};

// Mock serverAuth
vi.mock('@/lib/auth', () => ({
  serverAuth: {
    getUser: vi.fn(),
  },
}));

// Mock checkQuota
vi.mock('@/lib/billing/quota', () => ({
  checkQuota: vi.fn(),
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  standardRateLimiter: {
    limit: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from './route';
import { serverAuth } from '@/lib/auth';
import { checkQuota } from '@/lib/billing/quota';
import { standardRateLimiter } from '@/lib/rate-limit';

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/billing/usage', {
    method: 'GET',
  });
}

describe('GET /api/billing/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({
      allowed: false,
      response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }) as any,
    });

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(429);
  });

  it('should return usage data with correct shape', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });

    vi.mocked(checkQuota)
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 3 }) // cases
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 15 }) // documents
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 42 }) // ai_requests
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 2 }); // team_members

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      cases: 3,
      documents: 15,
      aiRequests: 42,
      teamMembers: 2,
    });
  });

  it('should call checkQuota for all metrics', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });
    vi.mocked(checkQuota).mockResolvedValue(mockQuotaResponse);

    const request = createMockRequest();
    await GET(request);

    expect(checkQuota).toHaveBeenCalledTimes(4);
    expect(checkQuota).toHaveBeenCalledWith(mockUserId, 'cases');
    expect(checkQuota).toHaveBeenCalledWith(mockUserId, 'documents');
    expect(checkQuota).toHaveBeenCalledWith(mockUserId, 'ai_requests');
    expect(checkQuota).toHaveBeenCalledWith(mockUserId, 'team_members');
  });

  it('should return 500 when checkQuota throws', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });
    vi.mocked(checkQuota).mockRejectedValue(new Error('Database connection failed'));

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch usage data');
  });

  it('should return 500 when one checkQuota call fails (partial failure)', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });

    vi.mocked(checkQuota)
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 3 })
      .mockRejectedValueOnce(new Error('Documents service unavailable'))
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 42 })
      .mockResolvedValueOnce({ ...mockQuotaResponse, current: 2 });

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch usage data');
  });

  it('should handle zero usage correctly', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });
    vi.mocked(checkQuota).mockResolvedValue({ ...mockQuotaResponse, current: 0 });

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({
      cases: 0,
      documents: 0,
      aiRequests: 0,
      teamMembers: 0,
    });
  });

  it('should handle unlimited quota correctly', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });
    vi.mocked(checkQuota).mockResolvedValue({
      allowed: true,
      current: 100,
      limit: -1,
      remaining: -1,
      isUnlimited: true,
    });

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.cases).toBe(100);
  });

  it('ignores userId query param and returns only authenticated user data (IDOR)', async () => {
    vi.mocked(serverAuth.getUser).mockResolvedValue({
      id: mockUserId,
      email: 'test@example.com',
    } as any);

    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true });
    vi.mocked(checkQuota).mockResolvedValue(mockQuotaResponse);

    const request = new NextRequest('http://localhost:3000/api/billing/usage?userId=attacker-id', {
      method: 'GET',
    });
    const response = await GET(request);
    const data = await response.json();

    expect(serverAuth.getUser).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(checkQuota).toHaveBeenCalledWith(mockUserId, 'cases');
    expect(checkQuota).not.toHaveBeenCalledWith('attacker-id', expect.anything());
  });
});
