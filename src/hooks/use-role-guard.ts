'use client';

/**
 * Route guard hooks for protecting pages based on user role.
 * Delegates to usePermissions for centralized permission logic.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePermissions, useCanPerform as useCanPerformFromPermissions } from './use-permissions';
import type { UserRole } from '@/types';

interface UseRoleGuardOptions {
  /** Specific roles required (overrides route-based checking) */
  requiredRoles?: UserRole[];
  /** Custom redirect path if access denied */
  redirectTo?: string;
  /** Skip the guard entirely (useful for conditional protection) */
  skip?: boolean;
}

interface UseRoleGuardReturn {
  /** Whether the access check is still in progress */
  isLoading: boolean;
  /** Whether the user has access to the current route/feature */
  hasAccess: boolean;
  /** The user's current role */
  role: UserRole | undefined;
  /** Whether a redirect is happening */
  isRedirecting: boolean;
}

/**
 * Hook for protecting pages/components based on user role.
 *
 * When used without options, it checks the current route against ROUTE_PERMISSIONS.
 * When used with requiredRoles, it checks if the user has one of those roles.
 *
 * @param options - Guard configuration options
 * @returns Loading state, access status, and user role
 *
 * @example
 * // Route-based protection (uses ROUTE_PERMISSIONS)
 * function ClientsPage() {
 *   const { isLoading, hasAccess } = useRoleGuard();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!hasAccess) return null; // Will redirect automatically
 *
 *   return <ClientsList />;
 * }
 *
 * @example
 * // Explicit role requirement
 * function AdminPanel() {
 *   const { isLoading, hasAccess } = useRoleGuard({
 *     requiredRoles: ['admin'],
 *     redirectTo: '/dashboard',
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (!hasAccess) return null;
 *
 *   return <AdminContent />;
 * }
 */
export function useRoleGuard(options: UseRoleGuardOptions = {}): UseRoleGuardReturn {
  const { requiredRoles, redirectTo, skip = false } = options;
  const router = useRouter();
  const pathname = usePathname();
  const { role, isLoading: isProfileLoading, canPerform, canAccessPath } = usePermissions();

  // Use ref + useSyncExternalStore pattern to avoid setState-in-effect lint error
  const redirectStateRef = useRef({ isRedirecting: false, listeners: new Set<() => void>() });

  const isRedirecting = useSyncExternalStore(
    (callback) => {
      redirectStateRef.current.listeners.add(callback);
      return () => redirectStateRef.current.listeners.delete(callback);
    },
    () => redirectStateRef.current.isRedirecting,
    () => false // Server snapshot
  );

  // Determine access
  let hasAccess = false;
  let computedRedirectTo = redirectTo || '/dashboard';

  if (skip) {
    hasAccess = true;
  } else if (requiredRoles && requiredRoles.length > 0) {
    // Explicit role check using centralized permission logic
    hasAccess = canPerform(requiredRoles);
  } else {
    // Route-based check using centralized RBAC
    const result = canAccessPath(pathname);
    hasAccess = result.allowed;
    if (!hasAccess && result.redirectTo) {
      computedRedirectTo = result.redirectTo;
    }
  }

  // Handle redirect when access denied
  useEffect(() => {
    if (isProfileLoading || skip) return;

    if (!hasAccess && !redirectStateRef.current.isRedirecting) {
      redirectStateRef.current.isRedirecting = true;
      redirectStateRef.current.listeners.forEach(listener => listener());
      router.replace(computedRedirectTo);
    }
  }, [isProfileLoading, hasAccess, router, computedRedirectTo, skip]);

  return {
    isLoading: isProfileLoading,
    hasAccess: skip ? true : hasAccess,
    role: role ?? undefined,
    isRedirecting,
  };
}

/**
 * Hook for checking if the current user can perform an action.
 * Unlike useRoleGuard, this doesn't redirect - just returns permission status.
 *
 * @param requiredRoles - Roles that can perform this action
 * @returns Whether the user has permission
 *
 * @example
 * function CaseActions() {
 *   const canCreateCase = useCanPerform(['attorney', 'admin']);
 *
 *   return (
 *     <div>
 *       {canCreateCase && (
 *         <Button onClick={handleCreate}>New Case</Button>
 *       )}
 *     </div>
 *   );
 * }
 */
export function useCanPerform(requiredRoles: UserRole[]): boolean {
  return useCanPerformFromPermissions(requiredRoles);
}
