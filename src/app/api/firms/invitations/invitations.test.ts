import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const VALID_TOKEN = 'valid-token-123';
const FIRM_ID = '550e8400-e29b-41d4-a716-446655440010';
const INVITER_ID = '550e8400-e29b-41d4-a716-446655440011';
const USER_ID = '550e8400-e29b-41d4-a716-446655440012';

const mockInvitation = {
  id: '550e8400-e29b-41d4-a716-446655440020',
  token: VALID_TOKEN,
  email: 'invited@example.com',
  role: 'attorney',
  status: 'pending',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  firm: {
    id: FIRM_ID,
    name: 'Test Law Firm',
  },
  inviter: {
    id: INVITER_ID,
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
  },
};

const mockUser = {
  id: USER_ID,
  email: 'invited@example.com',
};

const mockMember = {
  id: '550e8400-e29b-41d4-a716-446655440030',
  firmId: FIRM_ID,
  userId: USER_ID,
  role: 'attorney',
};

// Mock Supabase client for withAuth
let mockAuthUser: typeof mockUser | null = mockUser;

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

// Mock the firms DB functions
const mockGetInvitationByToken = vi.fn();
const mockAcceptInvitation = vi.fn();

vi.mock('@/lib/db/firms', () => ({
  getInvitationByToken: (...args: unknown[]) => mockGetInvitationByToken(...args),
  acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
}));

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    STANDARD: { maxRequests: 100, windowMs: 60000 },
    SENSITIVE: { maxRequests: 20, windowMs: 60000 },
  },
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

function createMockRequest(url: string, options: RequestInit = {}): NextRequest {
  const defaultHeaders = { 'x-forwarded-for': '127.0.0.1' };
  const mergedHeaders = { ...defaultHeaders, ...(options.headers as Record<string, string> || {}) };
  return new NextRequest(new URL(url, 'http://localhost:3000'), { ...options, headers: mergedHeaders });
}

describe('POST /api/firms/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
    mockGetInvitationByToken.mockResolvedValue(mockInvitation);
    mockAcceptInvitation.mockResolvedValue(mockMember);

    // withAuth uses supabase.auth.getUser + getProfileAsAdmin + rateLimit
    // Use mockImplementation so it reads mockAuthUser at call time (not setup time)
    mockSupabaseClient.auth.getUser.mockImplementation(() =>
      Promise.resolve({
        data: { user: mockAuthUser },
        error: mockAuthUser ? null : new Error('Not authenticated'),
      })
    );
    vi.mocked(getProfileAsAdmin).mockImplementation((userId: string) =>
      Promise.resolve({
        profile: { id: userId, role: 'attorney', full_name: 'Test User', email: mockAuthUser?.email || 'invited@example.com' },
        error: null,
      } as any)
    );
    vi.mocked(rateLimit).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Validation', () => {
    it('should accept when user email matches invitation email exactly', async () => {
      mockAuthUser = { id: USER_ID, email: 'invited@example.com' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(200);
      expect(mockAcceptInvitation).toHaveBeenCalled();
    });

    it('should handle case-insensitive email comparison', async () => {
      mockAuthUser = { id: USER_ID, email: 'INVITED@EXAMPLE.COM' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(200);
      expect(mockAcceptInvitation).toHaveBeenCalled();
    });

    it('should handle mixed case emails', async () => {
      mockAuthUser = { id: USER_ID, email: 'InViTeD@ExAmPlE.cOm' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(200);
    });

    it('should reject when user email differs from invitation email', async () => {
      mockAuthUser = { id: USER_ID, email: 'different@example.com' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('different email');
      expect(mockAcceptInvitation).not.toHaveBeenCalled();
    });

    it('should handle whitespace in invitation email', async () => {
      mockAuthUser = { id: USER_ID, email: 'invited@example.com' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: '  invited@example.com  ', // Whitespace around email
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(200);
      expect(mockAcceptInvitation).toHaveBeenCalled();
    });

    it('should handle whitespace in user email', async () => {
      mockAuthUser = { id: USER_ID, email: ' invited@example.com ' };
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(200);
      expect(mockAcceptInvitation).toHaveBeenCalled();
    });

    it('should handle user with null email', async () => {
      mockAuthUser = { id: USER_ID, email: null } as unknown as typeof mockUser;
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('different email');
    });

    it('should handle user with undefined email', async () => {
      mockAuthUser = { id: USER_ID } as unknown as typeof mockUser;
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        email: 'invited@example.com',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('different email');
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockAuthUser = null;

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });

      expect(response.status).toBe(401);
    });
  });

  describe('Invitation Status', () => {
    it('should return 404 when invitation not found', async () => {
      mockGetInvitationByToken.mockResolvedValue(null);

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/invalid-token`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: 'invalid-token' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 400 when invitation is already accepted', async () => {
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        status: 'accepted',
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('accepted');
    });

    it('should return 400 when invitation has expired', async () => {
      mockGetInvitationByToken.mockResolvedValue({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      const { POST } = await import('./[token]/route');
      const request = createMockRequest(
        `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`,
        { method: 'POST' }
      );

      const response = await POST(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('expired');
    });
  });
});

describe('GET /api/firms/invitations/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInvitationByToken.mockResolvedValue(mockInvitation);
    vi.mocked(rateLimit).mockResolvedValue({ success: true });
  });

  it('should return invitation details for valid token', async () => {
    const { GET } = await import('./[token]/route');
    const request = createMockRequest(
      `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`
    );

    const response = await GET(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe('invited@example.com');
    expect(data.data.firm).toBeDefined();
  });

  it('should return 404 for invalid token', async () => {
    mockGetInvitationByToken.mockResolvedValue(null);

    const { GET } = await import('./[token]/route');
    const request = createMockRequest(
      `http://localhost:3000/api/firms/invitations/invalid-token`
    );

    const response = await GET(request, { params: Promise.resolve({ token: 'invalid-token' }) });

    expect(response.status).toBe(404);
  });

  it('should return 400 for already accepted invitation', async () => {
    mockGetInvitationByToken.mockResolvedValue({
      ...mockInvitation,
      status: 'accepted',
    });

    const { GET } = await import('./[token]/route');
    const request = createMockRequest(
      `http://localhost:3000/api/firms/invitations/${VALID_TOKEN}`
    );

    const response = await GET(request, { params: Promise.resolve({ token: VALID_TOKEN }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('accepted');
  });
});
