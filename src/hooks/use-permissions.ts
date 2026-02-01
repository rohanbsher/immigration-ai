'use client';

import { useMemo } from 'react';
import { useUser } from './use-user';
import {
  canAccessRoute,
  hasPermission,
  meetsMinimumRole,
  getNavItemsForRole,
  MAIN_NAV_ITEMS,
  BOTTOM_NAV_ITEMS,
} from '@/lib/rbac';
import type { UserRole } from '@/types';

/**
 * Permission flags derived from user role.
 * Single source of truth for all permission checks.
 */
export interface Permissions {
  // Case permissions
  canManageCases: boolean;
  canViewCases: boolean;
  canCreateCases: boolean;

  // Document permissions
  canUploadDocuments: boolean;
  canAnalyzeDocuments: boolean;
  canVerifyDocuments: boolean;

  // Form permissions
  canManageForms: boolean;
  canUseAIAutofill: boolean;
  canReviewForms: boolean;
  canFileForms: boolean;

  // Client management
  canManageClients: boolean;
  canViewClients: boolean;

  // Admin permissions
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canViewSystemSettings: boolean;

  // Billing & team
  canManageBilling: boolean;
  canInviteTeam: boolean;
  canManageFirm: boolean;
}

/**
 * Get permissions for a specific role.
 * Centralizes all permission logic.
 */
function getPermissionsForRole(role: UserRole | null): Permissions {
  if (!role) {
    return {
      canManageCases: false,
      canViewCases: false,
      canCreateCases: false,
      canUploadDocuments: false,
      canAnalyzeDocuments: false,
      canVerifyDocuments: false,
      canManageForms: false,
      canUseAIAutofill: false,
      canReviewForms: false,
      canFileForms: false,
      canManageClients: false,
      canViewClients: false,
      canAccessAdmin: false,
      canManageUsers: false,
      canViewSystemSettings: false,
      canManageBilling: false,
      canInviteTeam: false,
      canManageFirm: false,
    };
  }

  switch (role) {
    case 'admin':
      return {
        canManageCases: true,
        canViewCases: true,
        canCreateCases: true,
        canUploadDocuments: true,
        canAnalyzeDocuments: true,
        canVerifyDocuments: true,
        canManageForms: true,
        canUseAIAutofill: true,
        canReviewForms: true,
        canFileForms: true,
        canManageClients: true,
        canViewClients: true,
        canAccessAdmin: true,
        canManageUsers: true,
        canViewSystemSettings: true,
        canManageBilling: true,
        canInviteTeam: true,
        canManageFirm: true,
      };

    case 'attorney':
      return {
        canManageCases: true,
        canViewCases: true,
        canCreateCases: true,
        canUploadDocuments: true,
        canAnalyzeDocuments: true,
        canVerifyDocuments: true,
        canManageForms: true,
        canUseAIAutofill: true,
        canReviewForms: true,
        canFileForms: true,
        canManageClients: true,
        canViewClients: true,
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemSettings: false,
        canManageBilling: true,
        canInviteTeam: true,
        canManageFirm: true,
      };

    case 'client':
      return {
        canManageCases: false,
        canViewCases: true,
        canCreateCases: false,
        canUploadDocuments: true,
        canAnalyzeDocuments: false,
        canVerifyDocuments: false,
        canManageForms: false,
        canUseAIAutofill: false,
        canReviewForms: false,
        canFileForms: false,
        canManageClients: false,
        canViewClients: false,
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemSettings: false,
        canManageBilling: false,
        canInviteTeam: false,
        canManageFirm: false,
      };

    default:
      return getPermissionsForRole(null);
  }
}

/**
 * Main permissions hook - single source of truth for role-based access.
 * Use this hook instead of useRole or useRoleGuard for permission checks.
 *
 * @example
 * ```tsx
 * function CaseActions() {
 *   const { permissions, role, isLoading } = usePermissions();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {permissions.canCreateCases && (
 *         <Button onClick={handleCreate}>New Case</Button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions() {
  const { profile, isLoading, error } = useUser();

  const role = profile?.role ?? null;

  const permissions = useMemo<Permissions>(
    () => getPermissionsForRole(role),
    [role]
  );

  // Role type checks
  const isAttorney = role === 'attorney';
  const isClient = role === 'client';
  const isAdmin = role === 'admin';
  const isElevated = role === 'attorney' || role === 'admin';

  // Navigation items filtered by role
  const mainNavItems = useMemo(
    () => getNavItemsForRole(role ?? undefined, MAIN_NAV_ITEMS),
    [role]
  );

  const bottomNavItems = useMemo(
    () => getNavItemsForRole(role ?? undefined, BOTTOM_NAV_ITEMS),
    [role]
  );

  /**
   * Check if user has one of the specified roles.
   */
  const hasRole = (checkRole: UserRole | UserRole[]): boolean => {
    if (!role) return false;
    if (Array.isArray(checkRole)) {
      return checkRole.includes(role);
    }
    return role === checkRole;
  };

  /**
   * Check if user can perform an action requiring specific roles.
   * Uses the centralized RBAC hasPermission function.
   */
  const canPerform = (requiredRoles: UserRole[]): boolean => {
    return hasPermission(role ?? undefined, requiredRoles);
  };

  /**
   * Check if user meets a minimum role level.
   * Uses the role hierarchy (client < attorney < admin).
   */
  const meetsMinRole = (minRole: UserRole): boolean => {
    return meetsMinimumRole(role ?? undefined, minRole);
  };

  /**
   * Check if user can access a specific route.
   */
  const canAccessPath = (pathname: string) => {
    return canAccessRoute(role ?? undefined, pathname);
  };

  return {
    // Core state
    role,
    isLoading,
    error,
    permissions,

    // Role type flags
    isAttorney,
    isClient,
    isAdmin,
    isElevated,

    // Navigation
    mainNavItems,
    bottomNavItems,

    // Check functions
    hasRole,
    canPerform,
    meetsMinRole,
    canAccessPath,
  };
}

/**
 * Check a single permission.
 * Simpler alternative when you only need one permission check.
 */
export function usePermission(permission: keyof Permissions): {
  allowed: boolean;
  isLoading: boolean;
} {
  const { permissions, isLoading } = usePermissions();
  return {
    allowed: permissions[permission],
    isLoading,
  };
}

/**
 * Check if user can perform an action with specific role requirements.
 * Returns boolean after loading.
 */
export function useCanPerform(requiredRoles: UserRole[]): boolean {
  const { canPerform, isLoading } = usePermissions();

  if (isLoading) return false;
  return canPerform(requiredRoles);
}

