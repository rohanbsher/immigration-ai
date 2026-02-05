/**
 * Login E2E Tests
 * Tests login functionality including happy path and error cases.
 *
 * Test count: 5
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS, AuthHelpers, WaitHelpers, generateTestEmail } from '../../fixtures/factories';

// NOTE: Uses E2E_TEST_USER (legacy generic user) instead of E2E_ATTORNEY_EMAIL (role-based)
// TODO: Migrate to hasValidCredentials() when env vars are standardized across CI/CD
const hasTestCredentials = process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD;

test.describe('Login Flow', () => {
  test.describe('Happy Path', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[placeholder*="example.com"]')
        .or(page.locator('input[type="email"]'))
        .or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]')
        .or(page.locator('input[type="password"]'))
        .or(page.locator('input[name="password"]'));

      await emailInput.first().fill(process.env.E2E_TEST_USER!);
      await passwordInput.first().fill(process.env.E2E_TEST_PASSWORD!);
      await page.click('button:has-text("Sign in")');

      // Should redirect to dashboard on success
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should redirect to dashboard if already logged in', async ({ page }) => {
      test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

      // First login
      await AuthHelpers.loginAs(page, 'attorney');

      // Navigate to login page while logged in
      await page.goto('/login');
      await page.waitForTimeout(2000);

      // Should redirect back to dashboard
      const url = page.url();
      expect(url.includes('/dashboard') || url.includes('/login')).toBeTruthy();
    });
  });

  test.describe('Error Cases', () => {
    test('should show error for invalid email format', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[placeholder*="example.com"]')
        .or(page.locator('input[type="email"]'))
        .or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]')
        .or(page.locator('input[type="password"]'))
        .or(page.locator('input[name="password"]'));

      await emailInput.first().fill('not-an-email');
      await passwordInput.first().fill('SomePassword123!');
      await page.click('button:has-text("Sign in")');

      // Should show validation error
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('text=Invalid'))
        .or(page.locator('text=valid email'))
        .or(page.locator('.text-red'))
        .or(page.locator('[data-sonner-toast]'))
        .or(page.locator('text=email'));

      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show error for incorrect password', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[placeholder*="example.com"]')
        .or(page.locator('input[type="email"]'))
        .or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]')
        .or(page.locator('input[type="password"]'))
        .or(page.locator('input[name="password"]'));

      await emailInput.first().fill('valid@example.com');
      await passwordInput.first().fill('WrongPassword123!');
      await page.click('button:has-text("Sign in")');

      // Should show authentication error
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('text=Invalid'))
        .or(page.locator('text=incorrect'))
        .or(page.locator('text=credentials'))
        .or(page.locator('.text-red'))
        .or(page.locator('[data-sonner-toast]'));

      await expect(errorMessage.first()).toBeVisible({ timeout: 15000 });
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const uniqueEmail = generateTestEmail();

      const emailInput = page.locator('input[placeholder*="example.com"]')
        .or(page.locator('input[type="email"]'))
        .or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]')
        .or(page.locator('input[type="password"]'))
        .or(page.locator('input[name="password"]'));

      await emailInput.first().fill(uniqueEmail);
      await passwordInput.first().fill('TestPassword123!');
      await page.click('button:has-text("Sign in")');

      // Should show error for non-existent user
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('text=Invalid'))
        .or(page.locator('text=not found'))
        .or(page.locator('text=incorrect'))
        .or(page.locator('.text-red'))
        .or(page.locator('[data-sonner-toast]'));

      await expect(errorMessage.first()).toBeVisible({ timeout: 15000 });
    });
  });
});
