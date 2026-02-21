import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './sidebar';

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
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useAuth
const mockSignOut = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    isLoading: false,
  }),
}));

// Mock next/navigation (override the global mock to control pathname)
const mockPush = vi.fn();
let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock FirmSwitcher
vi.mock('@/components/firm/firm-switcher', () => ({
  FirmSwitcher: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="firm-switcher" data-collapsed={collapsed}>
      Firm Switcher
    </div>
  ),
}));

// Mock keyboard shortcuts
vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  NAV_SHORTCUT_HINTS: {
    Dashboard: 'G D',
    Cases: 'G C',
    Tasks: 'G T',
    Settings: 'G S',
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Sidebar', () => {
  const defaultUser = {
    name: 'Jane Attorney',
    email: 'jane@law.com',
    avatarUrl: undefined,
    role: 'attorney',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockPathname = '/dashboard';
  });

  test('renders brand name CaseFill', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('CaseFill')).toBeInTheDocument();
  });

  test('renders main navigation items for attorney role', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Forms')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Firm')).toBeInTheDocument();
  });

  test('renders bottom navigation items for attorney role', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('does not render attorney-specific items for client role', () => {
    const clientUser = { ...defaultUser, role: 'client' };
    render(<Sidebar user={clientUser} />);

    // Client should NOT see attorney-only items
    expect(screen.queryByText('Cases')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
    expect(screen.queryByText('Clients')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
    expect(screen.queryByText('Firm')).not.toBeInTheDocument();

    // Client should see their own items
    expect(screen.getByText('My Cases')).toBeInTheDocument();
    expect(screen.getByText('My Documents')).toBeInTheDocument();
    // Client should see shared items
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('renders user name and role', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('Jane Attorney')).toBeInTheDocument();
    expect(screen.getByText('attorney')).toBeInTheDocument();
  });

  test('renders user initials in avatar fallback', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('JA')).toBeInTheDocument();
  });

  test('renders section headers (Workspace, Insights, Management, Account)', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  test('renders FirmSwitcher component', () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByTestId('firm-switcher')).toBeInTheDocument();
  });

  test('collapse toggle hides brand name and section headers', () => {
    render(<Sidebar user={defaultUser} />);

    // Find the collapse toggle button (ChevronLeft icon button)
    const collapseBtn = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('svg')
    );
    expect(collapseBtn).toBeDefined();

    if (collapseBtn) {
      fireEvent.click(collapseBtn);

      // Brand name should be hidden when collapsed
      expect(screen.queryByText('CaseFill')).not.toBeInTheDocument();
      // Section headers should be hidden when collapsed
      expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    }
  });

  test('collapse state persists to localStorage', () => {
    render(<Sidebar user={defaultUser} />);

    const collapseBtn = screen.getAllByRole('button').find(
      (btn) => btn.querySelector('svg')
    );

    if (collapseBtn) {
      fireEvent.click(collapseBtn);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
    }
  });

  test('logout button calls signOut', () => {
    render(<Sidebar user={defaultUser} />);

    // Find the logout button - it's the last icon button in the user profile area
    const buttons = screen.getAllByRole('button');
    const logoutBtn = buttons[buttons.length - 1];
    fireEvent.click(logoutBtn);

    expect(mockSignOut).toHaveBeenCalled();
  });

  test('renders default user text when user is not provided', () => {
    render(<Sidebar />);
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  test('renders no nav items when role is undefined', () => {
    render(<Sidebar user={undefined} />);
    // With no role, getNavItemsForRole returns []
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Cases')).not.toBeInTheDocument();
  });
});
