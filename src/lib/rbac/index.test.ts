/**
 * Unit tests for Role-Based Access Control (RBAC) service.
 * Tests route permissions, navigation filtering, and role hierarchy.
 */

import { describe, test, expect } from 'vitest';
import {
  canAccessRoute,
  getNavItemsForRole,
  hasPermission,
  meetsMinimumRole,
  ROLE_HIERARCHY,
  ROUTE_PERMISSIONS,
  MAIN_NAV_ITEMS,
  BOTTOM_NAV_ITEMS,
  type NavItemConfig,
} from './index';

describe('RBAC Service', () => {
  describe('canAccessRoute', () => {
    test('should allow attorney to access /dashboard/clients', () => {
      const result = canAccessRoute('attorney', '/dashboard/clients');

      expect(result.allowed).toBe(true);
      expect(result.redirectTo).toBe('');
    });

    test('should deny client from accessing /dashboard/clients', () => {
      const result = canAccessRoute('client', '/dashboard/clients');

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/dashboard');
    });

    test('should allow client to access /dashboard', () => {
      const result = canAccessRoute('client', '/dashboard');

      expect(result.allowed).toBe(true);
    });

    test('should redirect unauthenticated user to login', () => {
      const result = canAccessRoute(undefined, '/dashboard');

      expect(result.allowed).toBe(false);
      expect(result.redirectTo).toBe('/login');
    });

    test('should handle prefix matching for nested routes', () => {
      const result = canAccessRoute('attorney', '/dashboard/clients/123/details');

      expect(result.allowed).toBe(true);
      expect(result.matchedRule?.isPrefix).toBe(true);
    });

    test('should allow admin to access all protected routes', () => {
      const adminRoutes = [
        '/dashboard',
        '/dashboard/clients',
        '/dashboard/cases',
        '/dashboard/billing',
        '/dashboard/firm',
        '/admin',
        '/admin/settings',
      ];

      for (const route of adminRoutes) {
        const result = canAccessRoute('admin', route);
        expect(result.allowed).toBe(true);
      }
    });

    test('should deny non-admin from /admin routes', () => {
      const result = canAccessRoute('attorney', '/admin');

      expect(result.allowed).toBe(false);
    });

    test('should allow access to unknown routes by default', () => {
      const result = canAccessRoute('client', '/some/unknown/route');

      expect(result.allowed).toBe(true);
      expect(result.matchedRule).toBeUndefined();
    });
  });

  describe('getNavItemsForRole', () => {
    test('should filter navigation items for client role', () => {
      const items = getNavItemsForRole('client', MAIN_NAV_ITEMS);

      // Client should see client-specific nav items but NOT attorney/admin items
      expect(items.some(i => i.label === 'My Cases')).toBe(true);
      expect(items.some(i => i.label === 'My Documents')).toBe(true);
      expect(items.some(i => i.label === 'Dashboard')).toBe(false);
      expect(items.some(i => i.label === 'Cases')).toBe(false);
      expect(items.some(i => i.label === 'Documents')).toBe(false);
      expect(items.some(i => i.label === 'Tasks')).toBe(false);
      expect(items.some(i => i.label === 'Clients')).toBe(false);
    });

    test('should return all attorney/admin items for admin role', () => {
      const items = getNavItemsForRole('admin', MAIN_NAV_ITEMS);

      // Admin should see all attorney/admin items but not client-specific items
      const adminItems = MAIN_NAV_ITEMS.filter(i => i.allowedRoles.includes('admin'));
      expect(items.length).toBe(adminItems.length);
      expect(items.some(i => i.label === 'My Cases')).toBe(false);
      expect(items.some(i => i.label === 'My Documents')).toBe(false);
    });

    test('should return empty array for null/undefined role', () => {
      const items = getNavItemsForRole(undefined, MAIN_NAV_ITEMS);

      expect(items).toHaveLength(0);
    });

    test('should work with custom nav items', () => {
      const customItems: NavItemConfig[] = [
        { label: 'Admin Only', href: '/admin', allowedRoles: ['admin'] },
        { label: 'Everyone', href: '/public', allowedRoles: ['attorney', 'client', 'admin'] },
      ];

      const clientItems = getNavItemsForRole('client', customItems);

      expect(clientItems).toHaveLength(1);
      expect(clientItems[0].label).toBe('Everyone');
    });

    test('should filter bottom nav items correctly', () => {
      const clientBottom = getNavItemsForRole('client', BOTTOM_NAV_ITEMS);

      // Client should see Notifications and Settings but NOT Billing
      expect(clientBottom.some(i => i.label === 'Notifications')).toBe(true);
      expect(clientBottom.some(i => i.label === 'Settings')).toBe(true);
      expect(clientBottom.some(i => i.label === 'Billing')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    test('should return true when role is in the required list', () => {
      const result = hasPermission('attorney', ['attorney', 'admin']);

      expect(result).toBe(true);
    });

    test('should return false when role is not in the required list', () => {
      const result = hasPermission('client', ['attorney', 'admin']);

      expect(result).toBe(false);
    });

    test('should return false for null/undefined role', () => {
      const result = hasPermission(undefined, ['attorney', 'admin']);

      expect(result).toBe(false);
    });

    test('should handle single role in list', () => {
      expect(hasPermission('admin', ['admin'])).toBe(true);
      expect(hasPermission('client', ['admin'])).toBe(false);
    });
  });

  describe('meetsMinimumRole', () => {
    test('should check role hierarchy correctly', () => {
      // Admin >= attorney
      expect(meetsMinimumRole('admin', 'attorney')).toBe(true);

      // Attorney >= client
      expect(meetsMinimumRole('attorney', 'client')).toBe(true);

      // Client < attorney
      expect(meetsMinimumRole('client', 'attorney')).toBe(false);

      // Same role should pass
      expect(meetsMinimumRole('attorney', 'attorney')).toBe(true);
    });

    test('should return false for undefined role', () => {
      expect(meetsMinimumRole(undefined, 'client')).toBe(false);
    });

    test('should handle admin as minimum role', () => {
      expect(meetsMinimumRole('admin', 'admin')).toBe(true);
      expect(meetsMinimumRole('attorney', 'admin')).toBe(false);
      expect(meetsMinimumRole('client', 'admin')).toBe(false);
    });
  });

  describe('ROLE_HIERARCHY', () => {
    test('should have correct order (client < attorney < admin)', () => {
      expect(ROLE_HIERARCHY.client).toBeLessThan(ROLE_HIERARCHY.attorney);
      expect(ROLE_HIERARCHY.attorney).toBeLessThan(ROLE_HIERARCHY.admin);
    });

    test('should have all roles defined', () => {
      expect(ROLE_HIERARCHY).toHaveProperty('client');
      expect(ROLE_HIERARCHY).toHaveProperty('attorney');
      expect(ROLE_HIERARCHY).toHaveProperty('admin');
    });

    test('should have numeric values', () => {
      expect(typeof ROLE_HIERARCHY.client).toBe('number');
      expect(typeof ROLE_HIERARCHY.attorney).toBe('number');
      expect(typeof ROLE_HIERARCHY.admin).toBe('number');
    });
  });

  describe('ROUTE_PERMISSIONS', () => {
    test('should include all critical routes', () => {
      const paths = ROUTE_PERMISSIONS.map(r => r.path);

      expect(paths).toContain('/dashboard');
      expect(paths).toContain('/dashboard/clients');
      expect(paths).toContain('/dashboard/cases');
      expect(paths).toContain('/admin');
    });

    test('should have valid role arrays for all routes', () => {
      for (const route of ROUTE_PERMISSIONS) {
        expect(Array.isArray(route.allowedRoles)).toBe(true);
        expect(route.allowedRoles.length).toBeGreaterThan(0);

        // All roles should be valid UserRole values
        for (const role of route.allowedRoles) {
          expect(['attorney', 'client', 'admin']).toContain(role);
        }
      }
    });

    test('should protect admin routes for admin only', () => {
      const adminRoute = ROUTE_PERMISSIONS.find(r => r.path === '/admin');

      expect(adminRoute).toBeDefined();
      expect(adminRoute?.allowedRoles).toEqual(['admin']);
    });
  });

  describe('Edge cases', () => {
    test('should handle exact path match before prefix match', () => {
      // /dashboard should match exactly, not be treated as prefix of /dashboard/clients
      const dashboardResult = canAccessRoute('client', '/dashboard');
      const clientsResult = canAccessRoute('client', '/dashboard/clients');

      expect(dashboardResult.allowed).toBe(true);
      expect(clientsResult.allowed).toBe(false);
    });

    test('should handle trailing slash variations', () => {
      // Both should work the same way
      const withSlash = canAccessRoute('attorney', '/dashboard/clients/');
      const withoutSlash = canAccessRoute('attorney', '/dashboard/clients');

      // The prefix match handles /dashboard/clients/ as a child of /dashboard/clients
      expect(withSlash.allowed).toBe(true);
      expect(withoutSlash.allowed).toBe(true);
    });
  });
});
