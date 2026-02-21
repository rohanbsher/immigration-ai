import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Supabase mock state
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockUnsubscribe = vi.fn();
let authChangeCallback: ((event: string, session: unknown) => void) | null = null;

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { useUser, useUserFullName, useUserInitials, AuthTimeoutError } from './use-user';

const fakeUser = { id: 'user-1', email: 'test@example.com' };
const fakeSession = { user: fakeUser, access_token: 'token-abc' };

const fakeProfile = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'attorney' as const,
  first_name: 'Jane',
  last_name: 'Smith',
  phone: '555-1234',
  mfa_enabled: false,
  avatar_url: null,
  bar_number: 'BAR123',
  firm_name: 'Smith & Associates',
  specializations: ['immigration'],
  date_of_birth: null,
  country_of_birth: null,
  nationality: null,
  alien_number: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function setupSuccessfulAuth() {
  mockGetSession.mockResolvedValue({
    data: { session: fakeSession },
    error: null,
  });
  mockGetUser.mockResolvedValue({
    data: { user: fakeUser },
    error: null,
  });
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: fakeProfile,
          error: null,
        }),
      }),
    }),
  });
}

function setupNoSession() {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
}

describe('useUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
  });

  test('initial state has isLoading true and profile null', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUser());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.authError).toBeNull();
    expect(result.current.profileError).toBeNull();
  });

  test('returns profile when authenticated', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(fakeProfile);
    expect(result.current.error).toBeNull();
    expect(result.current.authError).toBeNull();
    expect(result.current.profileError).toBeNull();
  });

  test('returns null profile when no session exists', async () => {
    setupNoSession();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('returns null profile when getUser returns no user', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
  });

  test('sets error when getSession returns an error', async () => {
    const sessionError = new Error('Session fetch failed');
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: sessionError,
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(sessionError);
    expect(result.current.profile).toBeNull();
  });

  test('sets error when getUser returns an error', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    const userError = new Error('User validation failed');
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: userError,
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(userError);
    expect(result.current.profile).toBeNull();
  });

  test('sets profileError when profile fetch fails', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: fakeUser },
      error: null,
    });
    const profError = new Error('Profile not found');
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: profError,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profileError).toEqual(profError);
    expect(result.current.profile).toBeNull();
  });

  test('sets authError on timeout', async () => {
    // Simulate timeout by making getSession hang past AUTH_TIMEOUT_MS
    mockGetSession.mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new AuthTimeoutError()), 50);
      })
    );

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.authError).toBeInstanceOf(AuthTimeoutError);
    expect(result.current.profile).toBeNull();
  });

  test('onAuthStateChange SIGNED_IN triggers refetch', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(fakeProfile);

    // Auth state changes to SIGNED_IN
    const updatedProfile = { ...fakeProfile, first_name: 'Updated' };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedProfile,
            error: null,
          }),
        }),
      }),
    });

    act(() => {
      authChangeCallback!('SIGNED_IN', fakeSession);
    });

    await waitFor(() => {
      expect(result.current.profile?.first_name).toBe('Updated');
    });
  });

  test('onAuthStateChange SIGNED_OUT sets profile to null', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(fakeProfile);

    act(() => {
      authChangeCallback!('SIGNED_OUT', null);
    });

    expect(result.current.profile).toBeNull();
  });

  test('onAuthStateChange TOKEN_REFRESHED triggers refetch', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callCountBefore = mockGetSession.mock.calls.length;

    act(() => {
      authChangeCallback!('TOKEN_REFRESHED', fakeSession);
    });

    await waitFor(() => {
      expect(mockGetSession.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  test('refetch function re-fetches profile', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callCountBefore = mockGetSession.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetSession.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  test('unsubscribes from auth state changes on unmount', async () => {
    setupSuccessfulAuth();

    const { result, unmount } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('useUserFullName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
  });

  test('returns full name when profile is loaded', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUserFullName());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fullName).toBe('Jane Smith');
  });

  test('returns empty string when loading', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUserFullName());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fullName).toBe('');
  });

  test('returns empty string when no profile', async () => {
    setupNoSession();

    const { result } = renderHook(() => useUserFullName());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fullName).toBe('');
  });
});

describe('useUserInitials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
  });

  test('returns initials when profile is loaded', async () => {
    setupSuccessfulAuth();

    const { result } = renderHook(() => useUserInitials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initials).toBe('JS');
  });

  test('returns empty string when loading', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUserInitials());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.initials).toBe('');
  });

  test('returns empty string when no profile', async () => {
    setupNoSession();

    const { result } = renderHook(() => useUserInitials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.initials).toBe('');
  });
});

describe('AuthTimeoutError', () => {
  test('has correct name and message', () => {
    const error = new AuthTimeoutError();
    expect(error.name).toBe('AuthTimeoutError');
    expect(error.message).toBe(
      'Authentication check timed out. Please refresh the page or log in again.'
    );
    expect(error).toBeInstanceOf(Error);
  });
});
