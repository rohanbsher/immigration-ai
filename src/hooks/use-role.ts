'use client';

/**
 * @deprecated Use usePermissions from './use-permissions' instead.
 * This file is kept for backward compatibility.
 */

import { usePermissions, type Permissions } from './use-permissions';
import type { UserRole } from '@/types';

/**
 * @deprecated Use Permissions from './use-permissions' instead.
 */
export interface RolePermissions {
  canManageCases: boolean;
  canViewCases: boolean;
  canUploadDocuments: boolean;
  canAnalyzeDocuments: boolean;
  canManageForms: boolean;
  canUseAIAutofill: boolean;
  canReviewForms: boolean;
  canFileForms: boolean;
  canManageClients: boolean;
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canViewSystemSettings: boolean;
  canManageBilling: boolean;
  canInviteTeam: boolean;
}

/**
 * @deprecated Use usePermissions from './use-permissions' instead.
 *
 * Hook for checking user role and permissions.
 * Delegates to usePermissions for centralized permission logic.
 */
export function useRole() {
  const {
    role,
    isLoading,
    error,
    permissions,
    hasRole,
    isAttorney,
    isClient,
    isAdmin,
    isElevated,
  } = usePermissions();

  // Map new permissions to old RolePermissions interface for backward compatibility
  const legacyPermissions: RolePermissions = {
    canManageCases: permissions.canManageCases,
    canViewCases: permissions.canViewCases,
    canUploadDocuments: permissions.canUploadDocuments,
    canAnalyzeDocuments: permissions.canAnalyzeDocuments,
    canManageForms: permissions.canManageForms,
    canUseAIAutofill: permissions.canUseAIAutofill,
    canReviewForms: permissions.canReviewForms,
    canFileForms: permissions.canFileForms,
    canManageClients: permissions.canManageClients,
    canAccessAdmin: permissions.canAccessAdmin,
    canManageUsers: permissions.canManageUsers,
    canViewSystemSettings: permissions.canViewSystemSettings,
    canManageBilling: permissions.canManageBilling,
    canInviteTeam: permissions.canInviteTeam,
  };

  return {
    role,
    isLoading,
    error,
    permissions: legacyPermissions,
    hasRole,
    isAttorney,
    isClient,
    isAdmin,
    isElevated,
  };
}

/**
 * Hook for checking a specific permission.
 * Useful for simple permission checks in components.
 */
export function usePermission(permission: keyof RolePermissions): {
  allowed: boolean;
  isLoading: boolean;
} {
  const { permissions, isLoading } = useRole();
  return {
    allowed: permissions[permission],
    isLoading,
  };
}

/**
 * Hook for checking if user can access a route.
 */
export function useCanAccessRoute(
  requiredRoles?: UserRole[],
  requiredPermission?: keyof RolePermissions
): {
  canAccess: boolean;
  isLoading: boolean;
  reason?: string;
} {
  const { role, permissions, isLoading } = useRole();

  if (isLoading) {
    return { canAccess: false, isLoading: true };
  }

  if (!role) {
    return { canAccess: false, isLoading: false, reason: 'Not authenticated' };
  }

  if (requiredRoles && !requiredRoles.includes(role)) {
    return { canAccess: false, isLoading: false, reason: 'Insufficient role' };
  }

  if (requiredPermission && !permissions[requiredPermission]) {
    return { canAccess: false, isLoading: false, reason: 'Missing permission' };
  }

  return { canAccess: true, isLoading: false };
}
