'use client';

import { ReactNode } from 'react';
import { useRoleGuard } from '@/hooks/use-role-guard';
import { Loader2 } from 'lucide-react';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  /** Content to render when access is granted */
  children: ReactNode;
  /** Specific roles required to access this content */
  requiredRoles?: UserRole[];
  /** Custom redirect path if access denied */
  redirectTo?: string;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Content to show when access is denied (before redirect) */
  deniedComponent?: ReactNode;
}

/**
 * Component wrapper for role-based access control.
 *
 * Wraps content and only renders it if the user has the required role.
 * Automatically handles loading states and redirects.
 *
 * @example
 * // Protect entire page
 * <RoleGuard requiredRoles={['attorney', 'admin']}>
 *   <ClientsManagement />
 * </RoleGuard>
 *
 * @example
 * // Route-based protection (uses ROUTE_PERMISSIONS)
 * <RoleGuard>
 *   <PageContent />
 * </RoleGuard>
 *
 * @example
 * // Custom loading and denied states
 * <RoleGuard
 *   requiredRoles={['admin']}
 *   loadingComponent={<CustomSpinner />}
 *   deniedComponent={<AccessDeniedMessage />}
 * >
 *   <AdminPanel />
 * </RoleGuard>
 */
export function RoleGuard({
  children,
  requiredRoles,
  redirectTo,
  loadingComponent,
  deniedComponent,
}: RoleGuardProps) {
  const { isLoading, hasAccess, isRedirecting } = useRoleGuard({
    requiredRoles,
    redirectTo,
  });

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      loadingComponent ?? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )
    );
  }

  // Show denied state (briefly, before redirect)
  if (!hasAccess) {
    if (deniedComponent) {
      return <>{deniedComponent}</>;
    }

    // Default: show nothing while redirecting
    if (isRedirecting) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }

    return null;
  }

  // Access granted - render children
  return <>{children}</>;
}

/**
 * Wrapper for showing content only to specific roles.
 * Unlike RoleGuard, this doesn't redirect - just hides content.
 *
 * @example
 * <RoleOnly roles={['attorney', 'admin']}>
 *   <Button>Create New Case</Button>
 * </RoleOnly>
 */
interface RoleOnlyProps {
  children: ReactNode;
  roles: UserRole[];
  /** Content to show if user doesn't have the role */
  fallback?: ReactNode;
}

export function RoleOnly({ children, roles, fallback = null }: RoleOnlyProps) {
  const { isLoading, hasAccess } = useRoleGuard({
    requiredRoles: roles,
    skip: false,
  });

  // While loading, show nothing (or could show fallback)
  if (isLoading) {
    return null;
  }

  // Check permission without redirecting
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
