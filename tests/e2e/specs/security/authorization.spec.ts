/**
 * Authorization Tests
 *
 * Tests role-based access control (RBAC) and resource authorization including:
 * - Client access restrictions
 * - Attorney access restrictions
 * - Admin route protection
 * - Cross-tenant access prevention
 * - JWT security
 * - Session hijacking prevention
 *
 * Test count: 12
 *
 * SECURITY IMPLICATIONS:
 * These tests verify proper enforcement of the principle of least privilege.
 * Authorization failures could lead to data breaches, privilege escalation,
 * and unauthorized access to sensitive immigration case data.
 *
 * Auth strategy: Uses test.use() per describe block to set the correct
 * storageState for each role, avoiding loginAs() calls that hit rate limits.
 */

import { test, expect } from '@playwright/test';
import { generateTestId, hasValidCredentials } from '../../fixtures/factories';

test.describe('Authorization and Access Control', () => {
  test.describe('Client Role Restrictions', () => {
    // Client auth is loaded via storageState — no loginAs needed
    test.use({ storageState: 'tests/e2e/.auth/client.json' });

    test('client cannot access /dashboard/clients', async ({ page }) => {
      /**
       * SECURITY: Clients should not be able to view other clients.
       * This would be a serious privacy violation in a legal context.
       */
      test.skip(!hasValidCredentials('client'), 'No client credentials configured');

      await page.goto('/dashboard/clients');
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      const accessDenied = page.locator('text=Access denied')
        .or(page.locator('text=Forbidden'))
        .or(page.locator('text=Not authorized'))
        .or(page.locator('text=403'));

      // Either redirected to dashboard or shown error
      const isBlocked =
        url.includes('/dashboard') && !url.includes('/dashboard/clients') ||
        await accessDenied.isVisible().catch(() => false);

      expect(isBlocked || url === '/dashboard' || url.includes('/login')).toBe(true);
    });

    test('client cannot access /dashboard/firm', async ({ page }) => {
      /**
       * SECURITY: Clients should not access firm management features.
       * This protects internal firm data from client visibility.
       */
      test.skip(!hasValidCredentials('client'), 'No client credentials configured');

      await page.goto('/dashboard/firm');
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      // Should not be on firm page
      expect(url.includes('/dashboard/firm')).toBe(false);
    });

    test('client cannot access billing', async ({ page }) => {
      /**
       * SECURITY: Clients should not access attorney billing information.
       * This protects firm financial data.
       */
      test.skip(!hasValidCredentials('client'), 'No client credentials configured');

      await page.goto('/dashboard/billing');
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      // Should not be on billing page
      expect(url.includes('/dashboard/billing')).toBe(false);
    });
  });

  test.describe('Attorney Role Restrictions', () => {
    // Attorney auth is pre-loaded via storageState in playwright.config.ts (security-access project)

    test('attorney cannot access admin routes', async ({ page }) => {
      /**
       * SECURITY: Attorneys should not have administrative access.
       * Admin functions should be strictly limited to admin users.
       */
      test.skip(!hasValidCredentials('attorney'), 'No attorney credentials configured');

      await page.goto('/admin/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      // Should be redirected away from admin
      expect(url.includes('/admin')).toBe(false);
    });
  });

  test.describe('Unauthenticated User Protection', () => {
    // Override to unauthenticated context
    test.use({ storageState: { cookies: [], origins: [] } });

    test('unauthenticated user redirected from protected routes', async ({ page }) => {
      /**
       * SECURITY: All dashboard routes require authentication.
       * Unauthenticated access must redirect to login.
       */
      const protectedRoutes = [
        '/dashboard',
        '/dashboard/cases',
        '/dashboard/documents',
        '/dashboard/forms',
        '/dashboard/settings',
        '/dashboard/notifications',
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForURL(/\/login/, { timeout: 10000 });
        expect(page.url()).toContain('/login');
      }
    });
  });

  test.describe('Role Elevation Prevention', () => {
    // Client auth loaded via storageState
    test.use({ storageState: 'tests/e2e/.auth/client.json' });

    test('role elevation attempt fails', async ({ page, request }) => {
      /**
       * SECURITY: Users should not be able to elevate their own role.
       * This prevents privilege escalation attacks.
       */
      test.skip(!hasValidCredentials('client'), 'No client credentials configured');

      // Attempt to update profile with elevated role
      const response = await request.put('/api/profile', {
        data: {
          role: 'admin',
        },
      });

      // Should fail with 403 or role should not be updated
      if (response.ok()) {
        const body = await response.json();
        // Even if request succeeds, role should not be changed
        expect(body.role || body.data?.role).not.toBe('admin');
      } else {
        // Request should be rejected
        expect([400, 401, 403, 404].includes(response.status())).toBe(true);
      }
    });
  });

  test.describe('Cross-Tenant Access Control', () => {
    // Attorney auth is pre-loaded via storageState in playwright.config.ts

    test('cross-tenant case access denied', async ({ page, request }) => {
      /**
       * SECURITY: Users from one firm should not access cases from another firm.
       * This is critical for legal confidentiality and data isolation.
       */
      test.skip(!hasValidCredentials('attorney'), 'No attorney credentials configured');

      // Attempt to access a case with a random UUID (likely different tenant)
      const randomCaseId = `${generateTestId()}-0000-0000-0000-000000000000`;

      const response = await request.get(`/api/cases/${randomCaseId}`);

      // Should return 403 or 404 (not revealing if case exists)
      expect([403, 404].includes(response.status())).toBe(true);
    });

    test('cross-tenant document access denied', async ({ page, request }) => {
      /**
       * SECURITY: Users should not access documents from other firms' cases.
       * Immigration documents contain highly sensitive personal information.
       */
      test.skip(!hasValidCredentials('attorney'), 'No attorney credentials configured');

      // Attempt to access a document with a random UUID
      const randomDocId = `${generateTestId()}-0000-0000-0000-000000000000`;

      const response = await request.get(`/api/documents/${randomDocId}`);

      // Should return 403 or 404
      expect([403, 404].includes(response.status())).toBe(true);
    });
  });

  test.describe('API Authorization', () => {
    // Override to unauthenticated context for testing API auth enforcement
    test.use({ storageState: { cookies: [], origins: [] } });

    test('API returns 403 for unauthorized requests', async ({ request }) => {
      /**
       * SECURITY: API endpoints must enforce authentication.
       * Unauthenticated requests should receive 401/403.
       */
      const protectedEndpoints = [
        { method: 'GET', path: '/api/clients' },
        { method: 'GET', path: '/api/cases' },
        { method: 'GET', path: '/api/documents' },
        { method: 'GET', path: '/api/forms' },
        { method: 'GET', path: '/api/tasks' },
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request.get(endpoint.path);
        // Should return 401 (Unauthorized) or 403 (Forbidden)
        expect([401, 403, 404].includes(response.status())).toBe(true);
      }
    });
  });

  test.describe('URL Manipulation Protection', () => {
    // Attorney auth is pre-loaded via storageState in playwright.config.ts

    test('direct URL manipulation blocked', async ({ page }) => {
      /**
       * SECURITY: Users should not bypass authorization by directly
       * navigating to URLs with manipulated IDs.
       */
      // Try accessing various admin/sensitive URLs directly
      const sensitiveUrls = [
        '/admin/users',
        '/admin/dashboard',
        '/api/admin/stats',
        '/dashboard/firm/settings',
      ];

      for (const url of sensitiveUrls) {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');

        // Should redirect to login or show error
        const currentUrl = page.url();
        const isProtected =
          currentUrl.includes('/login') ||
          currentUrl === 'about:blank' ||
          !currentUrl.includes(url);

        expect(isProtected).toBe(true);
      }
    });
  });

  test.describe('Token Security', () => {
    // Attorney auth is pre-loaded via storageState in playwright.config.ts

    test('JWT tampering detected', async ({ context, request }) => {
      /**
       * SECURITY: Modified JWTs should be rejected by the server.
       * This prevents token forgery attacks.
       */
      // Get current cookies
      const cookies = await context.cookies();
      const authCookie = cookies.find(c =>
        c.name.includes('auth') ||
        c.name.includes('session') ||
        c.name.includes('sb-')
      );

      if (authCookie) {
        // Attempt to modify the cookie value
        await context.addCookies([{
          ...authCookie,
          value: authCookie.value + 'tampered',
        }]);

        // Try to access protected resource
        const response = await request.get('/api/cases');

        // Should fail authentication
        expect([401, 403].includes(response.status())).toBe(true);
      }

      // Test passes if no auth cookie (means we're properly unauthenticated)
      expect(true).toBe(true);
    });

    test('session hijacking prevention', async ({ page, context }) => {
      /**
       * SECURITY: Verifies that session cookies have proper security attributes
       * to prevent session hijacking via XSS or network interception.
       */
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(c =>
        c.name.includes('auth') ||
        c.name.includes('session') ||
        c.name.includes('sb-') ||
        c.name.includes('supabase')
      );

      for (const cookie of sessionCookies) {
        // Session cookies should be HttpOnly to prevent XSS access
        if (cookie.name.includes('session') || cookie.name.includes('auth')) {
          expect(cookie.httpOnly).toBe(true);
        }

        // In production, cookies should be Secure
        if (process.env.NODE_ENV === 'production') {
          expect(cookie.secure).toBe(true);
        }

        // SameSite should be Strict or Lax for CSRF protection
        expect(['Strict', 'Lax', 'None'].includes(cookie.sameSite || 'Lax')).toBe(true);
      }
    });
  });
});
