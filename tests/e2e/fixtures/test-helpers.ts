/**
 * @deprecated This file is DEPRECATED. Use factories.ts instead.
 *
 * WARNING: This file contains HARDCODED credentials (test@example.com,
 * attorney@example.com) that will be used as fallbacks if environment
 * variables are not set. This is dangerous for security and may cause
 * tests to pass against wrong accounts.
 *
 * Migration path:
 * - Replace: import { ... } from './test-helpers'
 * - With:    import { ... } from './factories'
 * - Replace: TEST_ATTORNEY → TEST_USERS.attorney (same role)
 * - Replace: TEST_USER → No direct equivalent; use TEST_USERS.attorney or .client
 *   depending on what role the test actually needs
 * - Replace: loginAs(page, email, pass) → AuthHelpers.loginAs(page, 'attorney')
 *
 * This file will be removed in a future PR after all tests are migrated.
 */

import { test as base, expect, Page } from '@playwright/test';

// Test user credentials (should match test database fixtures)
export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  name: 'Test User',
};

export const TEST_ATTORNEY = {
  email: 'attorney@example.com',
  password: 'AttorneyPass123!',
  name: 'Test Attorney',
};

// Extended test fixture with authentication helpers
export const test = base.extend<{
  authenticatedPage: Page;
  attorneyPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await use(page);
  },
  attorneyPage: async ({ page }, use) => {
    await loginAs(page, TEST_ATTORNEY.email, TEST_ATTORNEY.password);
    await use(page);
  },
});

export { expect };

// Login helper function
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

// Logout helper
export async function logout(page: Page): Promise<void> {
  // Look for user menu or logout button
  const userMenu = page.locator('[data-testid="user-menu"]').or(page.locator('button:has-text("Logout")'));
  if (await userMenu.isVisible()) {
    await userMenu.click();
  }

  const logoutButton = page.locator('button:has-text("Logout")').or(page.locator('[data-testid="logout-button"]'));
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }

  await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
}

// Wait for toast notification
export async function waitForToast(page: Page, message: string): Promise<void> {
  await expect(page.locator(`text="${message}"`).or(page.locator(`[role="alert"]:has-text("${message}")`)))
    .toBeVisible({ timeout: 5000 });
}

// Navigate to a dashboard section
export async function navigateTo(page: Page, section: string): Promise<void> {
  await page.goto(`/dashboard/${section}`);
  await page.waitForLoadState('networkidle');
}

// Generate unique test data
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

export function generateTestName(): string {
  return `Test User ${Date.now()}`;
}

// Wait for API response
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.waitForResponse((response) => {
    if (typeof urlPattern === 'string') {
      return response.url().includes(urlPattern);
    }
    return urlPattern.test(response.url());
  });
}

// Upload file helper
export async function uploadFile(
  page: Page,
  selector: string,
  filePath: string,
  fileName: string
): Promise<void> {
  const fileInput = page.locator(selector);
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from('Test PDF content'),
  });
}
