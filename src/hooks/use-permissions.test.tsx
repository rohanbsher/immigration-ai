import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import type { UserRole } from '@/types';

// Mock the useUser hook
const mockUseUser = vi.fn();
vi.mock('./use-user', () => ({
  useUser: () => mockUseUser(),
}));

// Mock the RBAC module
vi.mock('@/lib/rbac', () => ({
  canAccessRoute: vi.fn((role: UserRole | undefined, pathname: string) => {
    if (!role) {
      return { allowed: false, redirectTo: '/login' };
    }
    // Simulate route permission checks
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return { allowed: false, redirectTo: '/dashboard' };
    }
    if (pathname.startsWith('/dashboard/clients') && role === 'client') {
      return { allowed: false, redirectTo: '/dashboard' };
    }
    return { allowed: true, redirectTo: '' };
  }),
  hasPermission: vi.fn((role: UserRole | undefined, requiredRoles: UserRole[]) => {
    if (!role) return false;
    return requiredRoles.includes(role);
  }),
  meetsMinimumRole: vi.fn((userRole: UserRole | undefined, minRole: UserRole) => {
    if (!userRole) return false;
    const hierarchy: Record<UserRole, number> = { client: 1, attorney: 2, admin: 3 };
    return hierarchy[userRole] >= hierarchy[minRole];
  }),
  getNavItemsForRole: vi.fn((role: UserRole | undefined, items: unknown[]) => {
    if (!role) return [];
    return items;
  }),
  MAIN_NAV_ITEMS: [
    { label: 'Dashboard', href: '/dashboard', allowedRoles: ['attorney', 'client', 'admin'] },
  ],
  BOTTOM_NAV_ITEMS: [
    { label: 'Settings', href: '/dashboard/settings', allowedRoles: ['attorney', 'client', 'admin'] },
  ],
}));

// Import after mocking
import { usePermissions, usePermission, useCanPerform } from './use-permissions';
import { canAccessRoute } from '@/lib/rbac';

// Helper to create mock profile
function createMockProfile(role: UserRole) {
  return {
    id: `user-${role}`,
    email: `${role}@test.example.com`,
    role,
    first_name: 'Test',
    last_name: role.charAt(0).toUpperCase() + role.slice(1),
    phone: null,
    mfa_enabled: false,
    avatar_url: null,
    bar_number: role === 'attorney' ? 'BAR123' : null,
    firm_name: role === 'attorney' ? 'Test Firm' : null,
    specializations: null,
    date_of_birth: null,
    country_of_birth: null,
    nationality: null,
    alien_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

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

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission flags by role', () => {
    test('returns correct permissions for attorney role', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.permissions.canManageCases).toBe(true);
      expect(result.current.permissions.canViewCases).toBe(true);
      expect(result.current.permissions.canCreateCases).toBe(true);
      expect(result.current.permissions.canUploadDocuments).toBe(true);
      expect(result.current.permissions.canAnalyzeDocuments).toBe(true);
      expect(result.current.permissions.canVerifyDocuments).toBe(true);
      expect(result.current.permissions.canManageForms).toBe(true);
      expect(result.current.permissions.canManageClients).toBe(true);
      expect(result.current.permissions.canAccessAdmin).toBe(false);
      expect(result.current.permissions.canManageUsers).toBe(false);
    });

    test('returns correct permissions for client role', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('client'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.permissions.canManageCases).toBe(false);
      expect(result.current.permissions.canViewCases).toBe(true);
      expect(result.current.permissions.canCreateCases).toBe(false);
      expect(result.current.permissions.canUploadDocuments).toBe(true);
      expect(result.current.permissions.canAnalyzeDocuments).toBe(false);
      expect(result.current.permissions.canVerifyDocuments).toBe(false);
      expect(result.current.permissions.canManageForms).toBe(false);
      expect(result.current.permissions.canManageClients).toBe(false);
      expect(result.current.permissions.canAccessAdmin).toBe(false);
    });

    test('returns correct permissions for admin role', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('admin'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.permissions.canManageCases).toBe(true);
      expect(result.current.permissions.canViewCases).toBe(true);
      expect(result.current.permissions.canCreateCases).toBe(true);
      expect(result.current.permissions.canUploadDocuments).toBe(true);
      expect(result.current.permissions.canAnalyzeDocuments).toBe(true);
      expect(result.current.permissions.canVerifyDocuments).toBe(true);
      expect(result.current.permissions.canManageForms).toBe(true);
      expect(result.current.permissions.canManageClients).toBe(true);
      expect(result.current.permissions.canAccessAdmin).toBe(true);
      expect(result.current.permissions.canManageUsers).toBe(true);
      expect(result.current.permissions.canViewSystemSettings).toBe(true);
    });

    test('returns all false for null role', () => {
      mockUseUser.mockReturnValue({
        profile: null,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.permissions.canManageCases).toBe(false);
      expect(result.current.permissions.canViewCases).toBe(false);
      expect(result.current.permissions.canCreateCases).toBe(false);
      expect(result.current.permissions.canUploadDocuments).toBe(false);
      expect(result.current.permissions.canAnalyzeDocuments).toBe(false);
      expect(result.current.permissions.canAccessAdmin).toBe(false);
      expect(result.current.permissions.canManageUsers).toBe(false);
    });
  });

  describe('Role type flags', () => {
    test('isAttorney flag is correct', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAttorney).toBe(true);
      expect(result.current.isClient).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });

    test('isClient flag is correct', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('client'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAttorney).toBe(false);
      expect(result.current.isClient).toBe(true);
      expect(result.current.isAdmin).toBe(false);
    });

    test('isAdmin flag is correct', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('admin'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAttorney).toBe(false);
      expect(result.current.isClient).toBe(false);
      expect(result.current.isAdmin).toBe(true);
    });

    test('isElevated flag is correct for attorney', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isElevated).toBe(true);
    });

    test('isElevated flag is false for client', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('client'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isElevated).toBe(false);
    });
  });

  describe('hasRole function', () => {
    test('hasRole checks single role correctly', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasRole('attorney')).toBe(true);
      expect(result.current.hasRole('client')).toBe(false);
      expect(result.current.hasRole('admin')).toBe(false);
    });

    test('hasRole checks array of roles correctly', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.hasRole(['attorney', 'admin'])).toBe(true);
      expect(result.current.hasRole(['client', 'admin'])).toBe(false);
    });
  });

  describe('canPerform function', () => {
    test('canPerform returns correct result', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canPerform(['attorney', 'admin'])).toBe(true);
      expect(result.current.canPerform(['admin'])).toBe(false);
    });
  });

  describe('canAccessPath function', () => {
    test('canAccessPath delegates to RBAC', () => {
      mockUseUser.mockReturnValue({
        profile: createMockProfile('attorney'),
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(),
      });

      const accessResult = result.current.canAccessPath('/dashboard/clients');

      expect(canAccessRoute).toHaveBeenCalledWith('attorney', '/dashboard/clients');
      expect(accessResult.allowed).toBe(true);
    });
  });
});

describe('usePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns correct allowed status for a single permission', () => {
    mockUseUser.mockReturnValue({
      profile: createMockProfile('attorney'),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => usePermission('canManageCases'), {
      wrapper: createWrapper(),
    });

    expect(result.current.allowed).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  test('returns false when profile is loading', () => {
    mockUseUser.mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => usePermission('canManageCases'), {
      wrapper: createWrapper(),
    });

    expect(result.current.allowed).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });
});

describe('useCanPerform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns true when user has required role', () => {
    mockUseUser.mockReturnValue({
      profile: createMockProfile('attorney'),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCanPerform(['attorney', 'admin']), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(true);
  });

  test('returns false when user does not have required role', () => {
    mockUseUser.mockReturnValue({
      profile: createMockProfile('client'),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useCanPerform(['attorney', 'admin']), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });

  test('returns false while loading', () => {
    mockUseUser.mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useCanPerform(['attorney', 'admin']), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(false);
  });
});
