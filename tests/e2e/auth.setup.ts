/**
 * Auth Setup for E2E Tests
 * Creates and stores authenticated state for test users.
 * This runs before all test projects.
 */

import { test as setup, Page } from '@playwright/test';
import { TEST_USERS, hasValidCredentials, TestUserRole, TIMEOUTS } from './fixtures/factories';
import * as path from 'path';

const STORAGE_STATE_DIR = path.join(__dirname, '.auth');

// Auth state file paths
export const ATTORNEY_AUTH_FILE = path.join(STORAGE_STATE_DIR, 'attorney.json');
export const CLIENT_AUTH_FILE = path.join(STORAGE_STATE_DIR, 'client.json');
export const ADMIN_AUTH_FILE = path.join(STORAGE_STATE_DIR, 'admin.json');

/**
 * Shared authentication helper to reduce duplication
 */
async function authenticateRole(
  page: Page,
  role: TestUserRole,
  authFile: string
): Promise<void> {
  if (!hasValidCredentials(role)) {
    console.log(`⏭️  Skipping ${role} auth setup - no valid credentials`);
    return;
  }

  const user = TEST_USERS[role];

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Fill login form
  const emailInput = page.locator('input[placeholder*="example.com"]')
    .or(page.locator('input[type="email"]'))
    .or(page.locator('input[name="email"]'));
  const passwordInput = page.locator('input[placeholder*="password"]')
    .or(page.locator('input[type="password"]'))
    .or(page.locator('input[name="password"]'));

  await emailInput.first().fill(user.email);
  await passwordInput.first().fill(user.password);
  await page.click('button[type="submit"]');

  // Wait for successful login - add error context on failure
  try {
    await page.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.auth });
  } catch (error) {
    const err = error as Error;
    // Create a new error with context while preserving the original stack
    const wrappedError = new Error(`Failed to authenticate as ${role}: ${err.message}`);
    wrappedError.stack = `${wrappedError.message}\n\nCaused by: ${err.stack}`;
    throw wrappedError;
  }

  // Dismiss cookie consent banner to prevent dialog conflicts in tests
  await page.evaluate(() => {
    localStorage.setItem('casefill-consent', JSON.stringify({
      analytics: false,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }));
  });

  // Store authenticated state (includes cookies + localStorage with consent)
  await page.context().storageState({ path: authFile });
  console.log(`✅ ${role} auth state saved`);
}

setup.describe('Authentication Setup', () => {
  setup('authenticate as attorney', async ({ page }) => {
    await authenticateRole(page, 'attorney', ATTORNEY_AUTH_FILE);
  });

  setup('authenticate as client', async ({ page }) => {
    await authenticateRole(page, 'client', CLIENT_AUTH_FILE);
  });

  setup('authenticate as admin', async ({ page }) => {
    await authenticateRole(page, 'admin', ADMIN_AUTH_FILE);
  });
});
