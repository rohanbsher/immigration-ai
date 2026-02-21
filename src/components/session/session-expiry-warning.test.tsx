import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SessionExpiryWarning } from './session-expiry-warning';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard/cases',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Supabase client
const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
      signOut: mockSignOut,
    },
  }),
}));

describe('SessionExpiryWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('does not show warning when session has plenty of time', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });

  test('shows warning when session is within 5 minutes of expiry', async () => {
    // Session expires in 3 minutes (within the 5 min warning threshold)
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
  });

  test('renders Stay Logged In and Log Out buttons when warning is shown', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(screen.getByText('Stay Logged In')).toBeInTheDocument();
    expect(screen.getByText('Log Out')).toBeInTheDocument();
  });

  test('Stay Logged In button calls refreshSession', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          expires_at: Math.floor(Date.now() / 1000) + 7200,
        },
      },
      error: null,
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Stay Logged In'));
    });

    expect(mockRefreshSession).toHaveBeenCalled();
  });

  test('Log Out button calls signOut and redirects to login', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });
    mockSignOut.mockResolvedValue({});

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Log Out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  test('redirects to login when session has already expired', async () => {
    // Session already expired
    const expiresAt = Math.floor(Date.now() / 1000) - 60;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/login?returnUrl=')
    );
  });

  test('does not show warning when no session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });

  test('shows description text about unsaved changes', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(
      screen.getByText(/Any unsaved changes may be lost/)
    ).toBeInTheDocument();
  });

  test('shows Extending... text while refresh is in progress', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 180;
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: expiresAt } },
    });
    // Never resolve to keep isExtending=true
    let resolveRefresh: (value: unknown) => void;
    mockRefreshSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    // Click extend but don't resolve the promise
    await act(async () => {
      fireEvent.click(screen.getByText('Stay Logged In'));
    });

    expect(screen.getByText('Extending...')).toBeInTheDocument();

    // Clean up by resolving
    await act(async () => {
      resolveRefresh!({ data: { session: null }, error: null });
    });
  });

  test('does not show warning when session expires_at is absent', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: undefined } },
    });

    await act(async () => {
      render(<SessionExpiryWarning />);
    });

    expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
  });
});
