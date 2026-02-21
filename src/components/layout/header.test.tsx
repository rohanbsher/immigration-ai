import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './header';

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
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    isLoading: false,
  }),
}));

// State object for notification mocks (mutable properties on a const obj)
const notificationState = {
  unreadCount: undefined as number | undefined,
  notifications: [] as Array<{ id: string; title: string; message: string; action_url: string | null }>,
};

vi.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: () => ({ data: notificationState.unreadCount }),
  useNotifications: () => ({ data: notificationState.notifications }),
}));

// Mock AISearchInput
vi.mock('@/components/search/ai-search-input', () => ({
  AISearchInput: () => <div data-testid="ai-search-input">AI Search</div>,
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

describe('Header', () => {
  const defaultUser = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    avatarUrl: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    notificationState.unreadCount = undefined;
    notificationState.notifications = [];
  });

  test('renders page title when provided', () => {
    render(<Header title="Cases" user={defaultUser} />);
    expect(screen.getByText('Cases')).toBeInTheDocument();
  });

  test('does not render title when not provided', () => {
    render(<Header user={defaultUser} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  test('renders mobile menu button with correct aria label', () => {
    render(<Header user={defaultUser} onMenuClick={vi.fn()} />);
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  test('calls onMenuClick when mobile menu button is clicked', () => {
    const onMenuClick = vi.fn();
    render(<Header user={defaultUser} onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByLabelText('Open navigation menu'));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  test('renders user name', () => {
    render(<Header user={defaultUser} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  test('renders user initials as avatar fallback', () => {
    render(<Header user={defaultUser} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  test('renders "U" as initials when user name is not provided', () => {
    render(<Header />);
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  test('renders "User" as name when user is not provided', () => {
    render(<Header />);
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  test('renders notification badge with count when there are unread notifications', () => {
    notificationState.unreadCount = 5;
    render(<Header user={defaultUser} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('renders 9+ when unread count exceeds 9', () => {
    notificationState.unreadCount = 15;
    render(<Header user={defaultUser} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  test('does not render notification badge when unread count is undefined', () => {
    notificationState.unreadCount = undefined;
    render(<Header user={defaultUser} />);
    const notifButton = screen.getByLabelText('Notifications');
    // Should not contain a badge with any number
    expect(notifButton.querySelector('[aria-hidden="true"]:not(svg)')).not.toBeInTheDocument();
  });

  test('renders notification aria label with unread count', () => {
    notificationState.unreadCount = 3;
    render(<Header user={defaultUser} />);
    expect(screen.getByLabelText('Notifications, 3 unread')).toBeInTheDocument();
  });

  test('renders plain Notifications aria label when no unread', () => {
    notificationState.unreadCount = undefined;
    render(<Header user={defaultUser} />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  test('renders AI search input', () => {
    render(<Header user={defaultUser} />);
    expect(screen.getByTestId('ai-search-input')).toBeInTheDocument();
  });

  test('dispatches keyboard event when mobile search is clicked', () => {
    const spy = vi.spyOn(document, 'dispatchEvent');
    render(<Header user={defaultUser} />);
    fireEvent.click(screen.getByLabelText('Open search'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('renders notification bell button', () => {
    render(<Header user={defaultUser} />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  test('renders user menu trigger button', () => {
    render(<Header user={defaultUser} />);
    // The user name button is a dropdown trigger
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  test('renders initials for multi-part names', () => {
    const user = { name: 'Mary Jane Watson', email: 'mj@example.com' };
    render(<Header user={user} />);
    expect(screen.getByText('MJW')).toBeInTheDocument();
  });

  test('renders header element with correct structure', () => {
    const { container } = render(<Header title="Test" user={defaultUser} />);
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('h-16');
  });
});
