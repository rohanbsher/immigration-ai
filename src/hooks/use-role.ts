'use client';

import { useMemo } from 'react';
import { useUser } from './use-user';
import type { UserRole } from '@/types';

export interface RolePermissions {
  /** Can manage cases (create, edit, delete) */
  canManageCases: boolean;
  /** Can view cases */
  canViewCases: boolean;
  /** Can upload documents */
  canUploadDocuments: boolean;
  /** Can analyze documents with AI */
  canAnalyzeDocuments: boolean;
  /** Can manage forms */
  canManageForms: boolean;
  /** Can use AI autofill */
  canUseAIAutofill: boolean;
  /** Can review and approve forms */
  canReviewForms: boolean;
  /** Can file forms */
  canFileForms: boolean;
  /** Can manage clients */
  canManageClients: boolean;
  /** Can access admin dashboard */
  canAccessAdmin: boolean;
  /** Can manage users (admin only) */
  canManageUsers: boolean;
  /** Can view system settings */
  canViewSystemSettings: boolean;
  /** Can manage billing */
  canManageBilling: boolean;
  /** Can invite team members */
  canInviteTeam: boolean;
}

/**
 * Hook for checking user role and permissions.
 * Provides role information and permission flags for UI conditional rendering.
 */
export function useRole() {
  const { profile, isLoading, error } = useUser();

  const role = profile?.role ?? null;

  const permissions = useMemo<RolePermissions>(() => {
    if (!role) {
      // No role = no permissions
      return {
        canManageCases: false,
        canViewCases: false,
        canUploadDocuments: false,
        canAnalyzeDocuments: false,
        canManageForms: false,
        canUseAIAutofill: false,
        canReviewForms: false,
        canFileForms: false,
        canManageClients: false,
        canAccessAdmin: false,
        canManageUsers: false,
        canViewSystemSettings: false,
        canManageBilling: false,
        canInviteTeam: false,
      };
    }

    switch (role) {
      case 'admin':
        return {
          canManageCases: true,
          canViewCases: true,
          canUploadDocuments: true,
          canAnalyzeDocuments: true,
          canManageForms: true,
          canUseAIAutofill: true,
          canReviewForms: true,
          canFileForms: true,
          canManageClients: true,
          canAccessAdmin: true,
          canManageUsers: true,
          canViewSystemSettings: true,
          canManageBilling: true,
          canInviteTeam: true,
        };

      case 'attorney':
        return {
          canManageCases: true,
          canViewCases: true,
          canUploadDocuments: true,
          canAnalyzeDocuments: true,
          canManageForms: true,
          canUseAIAutofill: true,
          canReviewForms: true,
          canFileForms: true,
          canManageClients: true,
          canAccessAdmin: false,
          canManageUsers: false,
          canViewSystemSettings: false,
          canManageBilling: true,
          canInviteTeam: true,
        };

      case 'client':
        return {
          canManageCases: false,
          canViewCases: true,
          canUploadDocuments: true,
          canAnalyzeDocuments: false,
          canManageForms: false,
          canUseAIAutofill: false,
          canReviewForms: false,
          canFileForms: false,
          canManageClients: false,
          canAccessAdmin: false,
          canManageUsers: false,
          canViewSystemSettings: false,
          canManageBilling: false,
          canInviteTeam: false,
        };

      default:
        return {
          canManageCases: false,
          canViewCases: false,
          canUploadDocuments: false,
          canAnalyzeDocuments: false,
          canManageForms: false,
          canUseAIAutofill: false,
          canReviewForms: false,
          canFileForms: false,
          canManageClients: false,
          canAccessAdmin: false,
          canManageUsers: false,
          canViewSystemSettings: false,
          canManageBilling: false,
          canInviteTeam: false,
        };
    }
  }, [role]);

  /**
   * Check if user has a specific role.
   */
  const hasRole = (checkRole: UserRole | UserRole[]): boolean => {
    if (!role) return false;
    if (Array.isArray(checkRole)) {
      return checkRole.includes(role);
    }
    return role === checkRole;
  };

  /**
   * Check if user is an attorney.
   */
  const isAttorney = role === 'attorney';

  /**
   * Check if user is a client.
   */
  const isClient = role === 'client';

  /**
   * Check if user is an admin.
   */
  const isAdmin = role === 'admin';

  /**
   * Check if user has elevated privileges (attorney or admin).
   */
  const isElevated = role === 'attorney' || role === 'admin';

  return {
    role,
    isLoading,
    error,
    permissions,
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
