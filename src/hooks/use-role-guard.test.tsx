import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import type { UserRole } from '@/types';

// Mock Next.js navigation
const mockReplace = vi.fn();
const mockPathname = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname(),
}));

// Mock usePermissions
const mockCanPerform = vi.fn();
const mockCanAccessPath = vi.fn();
const mockRole = vi.fn<[], UserRole | null>();
const mockIsLoading = vi.fn(() => false);

vi.mock('./use-permissions', () => ({
  usePermissions: () => ({
    role: mockRole(),
    isLoading: mockIsLoading(),
    error: null,
    canPerform: mockCanPerform,
    canAccessPath: mockCanAccessPath,
    permissions: {},
    isAttorney: mockRole() === 'attorney',
    isClient: mockRole() === 'client',
    isAdmin: mockRole() === 'admin',
    isElevated: mockRole() === 'attorney' || mockRole() === 'admin',
    hasRole: vi.fn(),
    meetsMinRole: vi.fn(),
    mainNavItems: [],
    bottomNavItems: [],
  }),
  useCanPerform: vi.fn(() => false),
}));

// Import after mocking
import { useRoleGuard, useCanPerform } from './use-role-guard';

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  function TestQueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  TestQueryWrapper.displayName = 'TestQueryWrapper';
  return TestQueryWrapper;
}

describe('useRoleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole.mockReturnValue('attorney');
    mockIsLoading.mockReturnValue(false);
    mockCanPerform.mockReturnValue(true);
    mockCanAccessPath.mockReturnValue({ allowed: true, redirectTo: '' });
    mockPathname.mockReturnValue('/dashboard');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Access control', () => {
    test('returns hasAccess true for allowed route', () => {
      mockCanAccessPath.mockReturnValue({ allowed: true, redirectTo: '' });

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasAccess).toBe(true);
      expect(result.current.isRedirecting).toBe(false);
    });

    test('returns hasAccess false for denied route', () => {
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/dashboard' });
      mockRole.mockReturnValue('client');

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasAccess).toBe(false);
    });

    test('sets isRedirecting when access denied', async () => {
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/dashboard' });
      mockRole.mockReturnValue('client');

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      // Wait for the effect to run
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalled();
      });

      expect(result.current.hasAccess).toBe(false);
    });
  });

  describe('Skip option', () => {
    test('handles skip option correctly', () => {
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/dashboard' });
      mockRole.mockReturnValue('client');

      const { result } = renderHook(() => useRoleGuard({ skip: true }), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasAccess).toBe(true);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    test('no redirect when skip is true', async () => {
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/dashboard' });

      const { result } = renderHook(() => useRoleGuard({ skip: true }), {
        wrapper: createWrapper(),
      });

      // Allow some time for potential async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockReplace).not.toHaveBeenCalled();
      expect(result.current.hasAccess).toBe(true);
    });
  });

  describe('Required roles option', () => {
    test('uses requiredRoles when provided', () => {
      mockCanPerform.mockReturnValue(true);
      mockRole.mockReturnValue('attorney');

      const { result } = renderHook(
        () => useRoleGuard({ requiredRoles: ['attorney', 'admin'] }),
        { wrapper: createWrapper() }
      );

      expect(mockCanPerform).toHaveBeenCalledWith(['attorney', 'admin']);
      expect(result.current.hasAccess).toBe(true);
    });

    test('uses route-based check when no requiredRoles', () => {
      mockCanAccessPath.mockReturnValue({ allowed: true, redirectTo: '' });

      renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(mockCanAccessPath).toHaveBeenCalled();
    });
  });

  describe('Redirect behavior', () => {
    test('custom redirectTo is honored', async () => {
      mockCanPerform.mockReturnValue(false);
      mockRole.mockReturnValue('client');

      renderHook(
        () => useRoleGuard({
          requiredRoles: ['admin'],
          redirectTo: '/unauthorized',
        }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/unauthorized');
      });
    });

    test('redirect to /dashboard by default', async () => {
      mockCanPerform.mockReturnValue(false);
      mockRole.mockReturnValue('client');

      renderHook(
        () => useRoleGuard({ requiredRoles: ['admin'] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('redirect to /login when no role', async () => {
      mockRole.mockReturnValue(null);
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/login' });

      renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Loading state', () => {
    test('isLoading true while profile loading', () => {
      mockIsLoading.mockReturnValue(true);

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    test('no redirect while loading', async () => {
      mockIsLoading.mockReturnValue(true);
      mockCanAccessPath.mockReturnValue({ allowed: false, redirectTo: '/dashboard' });

      renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      // Allow some time for potential async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Role passthrough', () => {
    test('role from usePermissions is passed through', () => {
      mockRole.mockReturnValue('attorney');

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.role).toBe('attorney');
    });

    test('role is undefined when no profile', () => {
      mockRole.mockReturnValue(null);

      const { result } = renderHook(() => useRoleGuard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.role).toBeUndefined();
    });
  });
});

describe('useCanPerform (re-export)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('re-exports useCanPerform from use-permissions', () => {
    // The useCanPerform in use-role-guard delegates to use-permissions
    expect(useCanPerform).toBeDefined();
    expect(typeof useCanPerform).toBe('function');
  });
});
