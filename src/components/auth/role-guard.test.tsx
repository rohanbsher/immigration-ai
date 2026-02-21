import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard, RoleOnly } from './role-guard';

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

// Mock the hook
const mockUseRoleGuard = vi.fn();
vi.mock('@/hooks/use-role-guard', () => ({
  useRoleGuard: (...args: unknown[]) => mockUseRoleGuard(...args),
  useCanPerform: vi.fn().mockReturnValue(true),
}));

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    test('renders default loading spinner while checking permissions', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: true,
        hasAccess: false,
        role: undefined,
        isRedirecting: false,
      });

      const { container } = render(
        <RoleGuard>
          <div>Protected Content</div>
        </RoleGuard>
      );

      // Should NOT render children
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      // Should render the Loader2 spinner (an svg element with animate-spin class)
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    test('renders custom loading component when provided', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: true,
        hasAccess: false,
        role: undefined,
        isRedirecting: false,
      });

      render(
        <RoleGuard loadingComponent={<div>Loading permissions...</div>}>
          <div>Protected Content</div>
        </RoleGuard>
      );

      expect(screen.getByText('Loading permissions...')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('access granted', () => {
    test('renders children when user has access', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: false,
        hasAccess: true,
        role: 'attorney',
        isRedirecting: false,
      });

      render(
        <RoleGuard requiredRoles={['attorney', 'admin']}>
          <div>Protected Content</div>
        </RoleGuard>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    test('passes requiredRoles and redirectTo to the hook', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: false,
        hasAccess: true,
        role: 'admin',
        isRedirecting: false,
      });

      render(
        <RoleGuard requiredRoles={['admin']} redirectTo="/dashboard/settings">
          <div>Admin Panel</div>
        </RoleGuard>
      );

      expect(mockUseRoleGuard).toHaveBeenCalledWith({
        requiredRoles: ['admin'],
        redirectTo: '/dashboard/settings',
      });
    });
  });

  describe('access denied', () => {
    test('renders custom denied component when user lacks role', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: false,
        hasAccess: false,
        role: 'client',
        isRedirecting: false,
      });

      render(
        <RoleGuard
          requiredRoles={['attorney']}
          deniedComponent={<div>Access Denied - Attorneys Only</div>}
        >
          <div>Protected Content</div>
        </RoleGuard>
      );

      expect(screen.getByText('Access Denied - Attorneys Only')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    test('shows spinner when redirecting without denied component', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: false,
        hasAccess: false,
        role: 'client',
        isRedirecting: true,
      });

      const { container } = render(
        <RoleGuard requiredRoles={['attorney']}>
          <div>Protected Content</div>
        </RoleGuard>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    test('renders null when access denied and not redirecting and no denied component', () => {
      mockUseRoleGuard.mockReturnValue({
        isLoading: false,
        hasAccess: false,
        role: 'client',
        isRedirecting: false,
      });

      const { container } = render(
        <RoleGuard requiredRoles={['attorney']}>
          <div>Protected Content</div>
        </RoleGuard>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      // Nothing should be rendered (no spinner either since not redirecting)
      expect(container.innerHTML).toBe('');
    });
  });
});

describe('RoleOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders children when user has required role', () => {
    mockUseRoleGuard.mockReturnValue({
      isLoading: false,
      hasAccess: true,
      role: 'attorney',
      isRedirecting: false,
    });

    render(
      <RoleOnly roles={['attorney', 'admin']}>
        <button>Create Case</button>
      </RoleOnly>
    );

    expect(screen.getByRole('button', { name: /Create Case/i })).toBeInTheDocument();
  });

  test('renders fallback when user lacks required role', () => {
    mockUseRoleGuard.mockReturnValue({
      isLoading: false,
      hasAccess: false,
      role: 'client',
      isRedirecting: false,
    });

    render(
      <RoleOnly roles={['attorney']} fallback={<span>Not authorized</span>}>
        <button>Create Case</button>
      </RoleOnly>
    );

    expect(screen.queryByRole('button', { name: /Create Case/i })).not.toBeInTheDocument();
    expect(screen.getByText('Not authorized')).toBeInTheDocument();
  });

  test('renders nothing (null) as default fallback when user lacks role', () => {
    mockUseRoleGuard.mockReturnValue({
      isLoading: false,
      hasAccess: false,
      role: 'client',
      isRedirecting: false,
    });

    const { container } = render(
      <RoleOnly roles={['admin']}>
        <button>Delete All</button>
      </RoleOnly>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  test('renders nothing while loading', () => {
    mockUseRoleGuard.mockReturnValue({
      isLoading: true,
      hasAccess: false,
      role: undefined,
      isRedirecting: false,
    });

    const { container } = render(
      <RoleOnly roles={['attorney']}>
        <button>Action</button>
      </RoleOnly>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });
});
