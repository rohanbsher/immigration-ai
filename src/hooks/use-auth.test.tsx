import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import { TimeoutError } from '@/lib/api/fetch-with-timeout';

// --- Router mock (must be before import) ---
const mockPush = vi.fn();
const mockRefresh = vi.fn();

// Return a STABLE object to prevent useEffect infinite re-fire.
// useAuth has useEffect([supabase, router]) — a new object each render loops forever.
const stableRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: mockRefresh,
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// --- Supabase client mock ---
const mockGetSession = vi.fn();
let authChangeCallback: ((event: string, session: unknown) => void) | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

// --- Fetch mock ---
const mockFetchWithTimeout = vi.fn();
vi.mock('@/lib/api/fetch-with-timeout', () => {
  class MockTimeoutError extends Error {
    constructor(timeout: number) {
      super(`Request timed out after ${timeout / 1000} seconds`);
      this.name = 'TimeoutError';
    }
  }
  return {
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
    TimeoutError: MockTimeoutError,
  };
});

// --- Parse response mock ---
const mockParseApiResponse = vi.fn();
const mockParseApiVoidResponse = vi.fn();
vi.mock('@/lib/api/parse-response', () => ({
  parseApiResponse: (...args: unknown[]) => mockParseApiResponse(...args),
  parseApiVoidResponse: (...args: unknown[]) => mockParseApiVoidResponse(...args),
}));

const fakeUser = { id: 'user-1', email: 'test@example.com' };
const fakeSession = { user: fakeUser, access_token: 'token-123' };

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  test('initial state has isLoading true and user null', () => {
    // Block getSession so we can observe initial state
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('session fetch success with user populates state', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.session).toEqual(fakeSession);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test('session fetch success with no session sets user null', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('session fetch error sets error', async () => {
    const sessionError = new Error('Network error');
    mockGetSession.mockResolvedValue({ data: { session: null }, error: sessionError });
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(sessionError);
  });

  test('onAuthStateChange SIGNED_OUT calls router.push /login', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      authChangeCallback!('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  test('onAuthStateChange with new session updates user and session', async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      authChangeCallback!('SIGNED_IN', fakeSession);
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.session).toEqual(fakeSession);
    expect(result.current.isAuthenticated).toBe(true);
  });

  test('signUp success without requiresConfirmation navigates to dashboard', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let signUpResult: unknown;
    await act(async () => {
      signUpResult = await result.current.signUp({
        email: 'new@example.com',
        password: 'password123',
        role: 'attorney' as const,
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    expect(signUpResult).toEqual({ success: true });
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockRefresh).toHaveBeenCalled();
  });

  test('signUp with requiresConfirmation returns confirmation and does not navigate', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({
      requiresConfirmation: true,
      message: 'Check your email',
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let signUpResult: unknown;
    await act(async () => {
      signUpResult = await result.current.signUp({
        email: 'new@example.com',
        password: 'password123',
        role: 'attorney' as const,
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    expect(signUpResult).toEqual({
      requiresConfirmation: true,
      message: 'Check your email',
    });
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
  });

  test('signUp TimeoutError throws with registration timed out message', async () => {
    mockFetchWithTimeout.mockRejectedValue(new TimeoutError(30000));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signUp({
          email: 'new@example.com',
          password: 'password123',
          role: 'attorney' as const,
          firstName: 'John',
          lastName: 'Doe',
        });
      })
    ).rejects.toThrow('Registration timed out. Please try again.');
  });

  test('signIn success with default redirect pushes /dashboard', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({});

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
    expect(mockRefresh).toHaveBeenCalled();
  });

  test('signIn success with returnUrl pushes custom URL', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiResponse.mockResolvedValue({});

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signIn({
        email: 'test@example.com',
        password: 'password123',
        returnUrl: '/dashboard/cases/123',
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/dashboard/cases/123');
  });

  test('signIn TimeoutError throws with login timed out message', async () => {
    mockFetchWithTimeout.mockRejectedValue(new TimeoutError(30000));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signIn({
          email: 'test@example.com',
          password: 'password123',
        });
      })
    ).rejects.toThrow('Login timed out. Please try again.');
  });

  test('signOut success pushes /login', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: true });
    mockParseApiVoidResponse.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockRefresh).toHaveBeenCalled();
  });

  test('signOut TimeoutError still pushes /login gracefully', async () => {
    mockFetchWithTimeout.mockRejectedValue(new TimeoutError(10000));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
