/**
 * Integration tests for Profile API route.
 *
 * Tests cover:
 * - GET /api/profile - Get current user profile
 * - PATCH /api/profile - Update current user profile
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUserId = 'user-123';

const mockProfile = {
  id: mockUserId,
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  avatar_url: null,
  bar_number: null,
  firm_name: null,
  specializations: null,
  date_of_birth: '1990-01-15',
  country_of_birth: 'United States',
  nationality: 'American',
  alien_number: null,
  role: 'attorney',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

vi.mock('@/lib/db', () => ({
  profilesService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  standardRateLimiter: {
    limit: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

vi.mock('@/lib/crypto', () => ({
  encryptSensitiveFields: vi.fn((data: any) => data),
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

import { GET, PATCH } from './route';
import { profilesService } from '@/lib/db';
import { standardRateLimiter } from '@/lib/rate-limit';
import { encryptSensitiveFields } from '@/lib/crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
) {
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
    req.json = async () => body;
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Profile API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId, email: 'test@example.com' } },
      error: null,
    });

    // Default rate limit: allow
    vi.mocked(standardRateLimiter.limit).mockResolvedValue({ allowed: true } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GET /api/profile
  // ==========================================================================
  describe('GET /api/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('GET', '/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as any);

      const request = createRequest('GET', '/api/profile');
      const response = await GET(request);

      expect(response.status).toBe(429);
    });

    it('should return 200 with profile data', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(mockProfile as any);

      const request = createRequest('GET', '/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(mockUserId);
      expect(data.first_name).toBe('John');
      expect(data.last_name).toBe('Doe');
      expect(profilesService.getProfile).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 404 when profile not found', async () => {
      vi.mocked(profilesService.getProfile).mockResolvedValue(null);

      const request = createRequest('GET', '/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Profile not found');
    });

    it('should return 500 on error', async () => {
      vi.mocked(profilesService.getProfile).mockRejectedValue(new Error('DB error'));

      const request = createRequest('GET', '/api/profile');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch profile');
    });
  });

  // ==========================================================================
  // PATCH /api/profile
  // ==========================================================================
  describe('PATCH /api/profile', () => {
    it('should return 401 when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createRequest('PATCH', '/api/profile', { first_name: 'Jane' });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(standardRateLimiter.limit).mockResolvedValue({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as any);

      const request = createRequest('PATCH', '/api/profile', { first_name: 'Jane' });
      const response = await PATCH(request);

      expect(response.status).toBe(429);
    });

    it('should return 400 for invalid Zod schema', async () => {
      const request = createRequest('PATCH', '/api/profile', {
        first_name: '', // min(1) fails
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid avatar_url', async () => {
      const request = createRequest('PATCH', '/api/profile', {
        avatar_url: 'not-a-url',
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 200 with updated profile', async () => {
      const updatedProfile = { ...mockProfile, first_name: 'Jane' };
      vi.mocked(profilesService.updateProfile).mockResolvedValue(updatedProfile as any);

      const request = createRequest('PATCH', '/api/profile', { first_name: 'Jane' });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.first_name).toBe('Jane');
      expect(profilesService.updateProfile).toHaveBeenCalledWith(mockUserId, { first_name: 'Jane' });
    });

    it('should encrypt sensitive fields before saving', async () => {
      const encryptedData = { alien_number: 'encrypted-value' };
      vi.mocked(encryptSensitiveFields).mockReturnValue(encryptedData as any);
      vi.mocked(profilesService.updateProfile).mockResolvedValue({ ...mockProfile, ...encryptedData } as any);

      const request = createRequest('PATCH', '/api/profile', { alien_number: 'A12345' });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      expect(encryptSensitiveFields).toHaveBeenCalledWith({ alien_number: 'A12345' });
      expect(profilesService.updateProfile).toHaveBeenCalledWith(mockUserId, encryptedData);
    });

    it('should handle nullable fields', async () => {
      const updatedProfile = { ...mockProfile, phone: null, bar_number: null };
      vi.mocked(profilesService.updateProfile).mockResolvedValue(updatedProfile as any);

      const request = createRequest('PATCH', '/api/profile', {
        phone: null,
        bar_number: null,
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phone).toBeNull();
    });

    it('should return 500 on error', async () => {
      vi.mocked(profilesService.updateProfile).mockRejectedValue(new Error('DB error'));

      const request = createRequest('PATCH', '/api/profile', { first_name: 'Jane' });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update profile');
    });
  });
});
