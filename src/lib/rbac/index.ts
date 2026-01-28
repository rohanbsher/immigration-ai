/**
 * Role-Based Access Control (RBAC) for frontend route protection.
 *
 * This module provides:
 * - Route permission definitions
 * - Role-based access checking
 * - Navigation item filtering by role
 */

import type { UserRole } from '@/types';

/**
 * Route permission configuration.
 * Each route specifies which roles can access it.
 */
export interface RoutePermission {
  /** The route path pattern (exact match or prefix) */
  path: string;
  /** Roles allowed to access this route */
  allowedRoles: UserRole[];
  /** If true, path is checked as prefix (e.g., /admin matches /admin/users) */
  isPrefix?: boolean;
}

/**
 * Comprehensive route permissions for the application.
 * Order matters - more specific routes should come before general ones.
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Admin-only routes
  { path: '/admin', allowedRoles: ['admin'], isPrefix: true },

  // Client portal routes (client-only)
  { path: '/dashboard/client', allowedRoles: ['client'], isPrefix: true },

  // Attorney and admin routes (not accessible by clients)
  { path: '/dashboard/clients', allowedRoles: ['attorney', 'admin'], isPrefix: true },
  { path: '/dashboard/cases/new', allowedRoles: ['attorney', 'admin'] },
  { path: '/dashboard/tasks', allowedRoles: ['attorney', 'admin'], isPrefix: true },

  // Attorney and admin routes for billing and firm
  { path: '/dashboard/billing', allowedRoles: ['attorney', 'admin'], isPrefix: true },
  { path: '/dashboard/firm', allowedRoles: ['attorney', 'admin'], isPrefix: true },

  // Routes accessible by all authenticated users
  { path: '/dashboard', allowedRoles: ['attorney', 'client', 'admin'] },
  { path: '/dashboard/cases', allowedRoles: ['attorney', 'client', 'admin'], isPrefix: true },
  { path: '/dashboard/documents', allowedRoles: ['attorney', 'client', 'admin'], isPrefix: true },
  { path: '/dashboard/forms', allowedRoles: ['attorney', 'client', 'admin'], isPrefix: true },
  { path: '/dashboard/notifications', allowedRoles: ['attorney', 'client', 'admin'] },
  { path: '/dashboard/settings', allowedRoles: ['attorney', 'client', 'admin'], isPrefix: true },
];

/**
 * Result of checking route access.
 */
export interface AccessCheckResult {
  /** Whether the user is allowed to access the route */
  allowed: boolean;
  /** If not allowed, where to redirect */
  redirectTo: string;
  /** The matched permission rule (if any) */
  matchedRule?: RoutePermission;
}

/**
 * Checks if a user role can access a given route.
 *
 * @param role - The user's role
 * @param pathname - The route pathname to check
 * @returns Access check result with redirect info if denied
 *
 * @example
 * const { allowed, redirectTo } = canAccessRoute('client', '/dashboard/clients');
 * if (!allowed) {
 *   router.push(redirectTo);
 * }
 */
export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string
): AccessCheckResult {
  // No role means not authenticated - redirect to login
  if (!role) {
    return {
      allowed: false,
      redirectTo: '/login',
    };
  }

  // Find the matching permission rule
  const matchedRule = ROUTE_PERMISSIONS.find((perm) => {
    if (perm.isPrefix) {
      return pathname === perm.path || pathname.startsWith(`${perm.path}/`);
    }
    return pathname === perm.path;
  });

  // If no rule found, allow by default (public routes)
  if (!matchedRule) {
    return { allowed: true, redirectTo: '' };
  }

  // Check if user's role is in the allowed list
  const allowed = matchedRule.allowedRoles.includes(role);

  return {
    allowed,
    redirectTo: allowed ? '' : '/dashboard',
    matchedRule,
  };
}

/**
 * Navigation items with their required roles.
 */
export interface NavItemConfig {
  label: string;
  href: string;
  allowedRoles: UserRole[];
}

/**
 * Main navigation items configuration.
 */
export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  { label: 'Dashboard', href: '/dashboard', allowedRoles: ['attorney', 'client', 'admin'] },
  { label: 'Cases', href: '/dashboard/cases', allowedRoles: ['attorney', 'client', 'admin'] },
  { label: 'Documents', href: '/dashboard/documents', allowedRoles: ['attorney', 'client', 'admin'] },
  { label: 'Forms', href: '/dashboard/forms', allowedRoles: ['attorney', 'client', 'admin'] },
  { label: 'Tasks', href: '/dashboard/tasks', allowedRoles: ['attorney', 'admin'] },
  { label: 'Clients', href: '/dashboard/clients', allowedRoles: ['attorney', 'admin'] },
  { label: 'Firm', href: '/dashboard/firm', allowedRoles: ['attorney', 'admin'] },
];

/**
 * Bottom navigation items configuration.
 */
export const BOTTOM_NAV_ITEMS: NavItemConfig[] = [
  { label: 'Billing', href: '/dashboard/billing', allowedRoles: ['attorney', 'admin'] },
  { label: 'Notifications', href: '/dashboard/notifications', allowedRoles: ['attorney', 'client', 'admin'] },
  { label: 'Settings', href: '/dashboard/settings', allowedRoles: ['attorney', 'client', 'admin'] },
];

/**
 * Filters navigation items based on user role.
 *
 * @param role - The user's role
 * @param items - Navigation items to filter
 * @returns Filtered navigation items the user can access
 *
 * @example
 * const navItems = getNavItemsForRole('client', MAIN_NAV_ITEMS);
 * // Returns items accessible by clients (excluding 'Clients')
 */
export function getNavItemsForRole(
  role: UserRole | undefined,
  items: NavItemConfig[] = MAIN_NAV_ITEMS
): NavItemConfig[] {
  if (!role) return [];

  return items.filter((item) => item.allowedRoles.includes(role));
}

/**
 * Check if a user has a specific permission.
 * Useful for UI element visibility.
 *
 * @param role - The user's role
 * @param requiredRoles - Roles that have this permission
 * @returns Whether the user has the permission
 */
export function hasPermission(
  role: UserRole | undefined,
  requiredRoles: UserRole[]
): boolean {
  if (!role) return false;
  return requiredRoles.includes(role);
}

/**
 * Role hierarchy for permission inheritance (optional).
 * Higher roles have all permissions of lower roles.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  client: 1,
  attorney: 2,
  admin: 3,
};

/**
 * Check if a role meets a minimum required level.
 *
 * @param userRole - The user's role
 * @param minRole - Minimum required role
 * @returns Whether user meets the minimum role requirement
 */
export function meetsMinimumRole(
  userRole: UserRole | undefined,
  minRole: UserRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}
