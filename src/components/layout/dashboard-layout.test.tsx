import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardLayout } from './dashboard-layout';

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

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    isLoading: false,
  }),
}));

// Mock useNotifications / useUnreadCount
vi.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: () => ({ data: 0 }),
  useNotifications: () => ({ data: [] }),
}));

// Mock useUser
let mockUseUserReturn: {
  profile: Record<string, unknown> | null;
  isLoading: boolean;
  error: Error | null;
  authError: Error | null;
  profileError: Error | null;
  refetch: () => Promise<void>;
} = {
  profile: null,
  isLoading: true,
  error: null,
  authError: null,
  profileError: null,
  refetch: vi.fn(),
};

vi.mock('@/hooks/use-user', () => ({
  useUser: () => mockUseUserReturn,
}));

// Mock useKeyboardShortcuts
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: () => ({
    shortcuts: [],
    dialogOpen: false,
    setDialogOpen: vi.fn(),
  }),
  NAV_SHORTCUT_HINTS: {},
}));

// Mock child components
vi.mock('./sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('./header', () => ({
  Header: ({ title }: { title?: string }) => (
    <div data-testid="header">{title || 'Header'}</div>
  ),
}));

vi.mock('./command-palette', () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock('./keyboard-shortcuts-dialog', () => ({
  KeyboardShortcutsDialog: () => <div data-testid="keyboard-shortcuts-dialog" />,
}));

vi.mock('@/components/session/session-expiry-warning', () => ({
  SessionExpiryWarning: () => <div data-testid="session-expiry-warning" />,
}));

vi.mock('./idle-timeout', () => ({
  IdleTimeoutProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/onboarding/onboarding-checklist', () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}));

vi.mock('@/components/search/ai-search-input', () => ({
  AISearchInput: () => <div data-testid="ai-search-input" />,
}));

vi.mock('@/components/firm/firm-switcher', () => ({
  FirmSwitcher: () => <div data-testid="firm-switcher" />,
}));

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => () => null,
}));

// Mock supabase client for sign out
const mockSignOutSupabase = vi.fn().mockResolvedValue({});
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      signOut: mockSignOutSupabase,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserReturn = {
      profile: null,
      isLoading: true,
      error: null,
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };
  });

  test('shows loading spinner while loading', () => {
    mockUseUserReturn = {
      profile: null,
      isLoading: true,
      error: null,
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    // Loading spinner should be present (Loader2 component)
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  test('shows auth error state when authError is set', () => {
    mockUseUserReturn = {
      profile: null,
      isLoading: false,
      error: null,
      authError: new Error('Auth timeout') as any,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Connection Issue')).toBeInTheDocument();
  });

  test('shows session expired state when error is set', () => {
    mockUseUserReturn = {
      profile: null,
      isLoading: false,
      error: new Error('Session error'),
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  test('shows profile error state when profileError is set', () => {
    mockUseUserReturn = {
      profile: null,
      isLoading: false,
      error: null,
      authError: null,
      profileError: new Error('Profile fetch failed'),
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Unable to Load Profile')).toBeInTheDocument();
  });

  test('renders children when profile is loaded', () => {
    mockUseUserReturn = {
      profile: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        role: 'attorney',
        avatar_url: null,
      },
      isLoading: false,
      error: null,
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Dashboard Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  test('renders sidebar, header, and command palette when loaded', () => {
    mockUseUserReturn = {
      profile: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        role: 'attorney',
        avatar_url: null,
      },
      isLoading: false,
      error: null,
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout title="Cases">
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
  });

  test('calls refetch when "Try Again" is clicked in error state', () => {
    const mockRefetch = vi.fn();
    mockUseUserReturn = {
      profile: null,
      isLoading: false,
      error: new Error('Error'),
      authError: null,
      profileError: null,
      refetch: mockRefetch,
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  test('renders onboarding checklist in loaded state', () => {
    mockUseUserReturn = {
      profile: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        role: 'attorney',
        avatar_url: null,
      },
      isLoading: false,
      error: null,
      authError: null,
      profileError: null,
      refetch: vi.fn(),
    };

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
  });
});
