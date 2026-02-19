/**
 * Visual Regression Tests
 *
 * Captures screenshots of key pages and compares them against baseline images.
 * Uses Playwright's built-in `toHaveScreenshot()` with configurable thresholds.
 *
 * Run `npx playwright test --update-snapshots` to generate/update baselines.
 *
 * Test count: 5
 */

import { test, expect } from '@playwright/test';
import { hasValidCredentials, dismissConsent } from '../../fixtures/factories';

test.describe('Visual Regression', () => {
  // Visual regression requires platform-specific baseline screenshots.
  // Skip in CI unless baselines have been generated with `--update-snapshots`.
  test.skip(!!process.env.CI, 'Visual regression baselines are platform-dependent — run locally');

  test.describe('Authenticated Pages', () => {
    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('attorney'), 'Missing attorney test credentials');
    });

    test('dashboard overview', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      // Wait for KPI cards and charts to render
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('dashboard-overview.png', {
        maxDiffPixelRatio: 0.05,
        // Mask dynamic content that changes between runs
        mask: [
          page.locator('time'),
          page.locator('[data-testid="timestamp"]'),
          page.locator('[data-testid="user-menu"]'),
        ],
      });
    });

    test('cases list page', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('cases-list.png', {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator('time'),
          page.locator('[data-testid="timestamp"]'),
        ],
      });
    });

    test('billing page', async ({ page }) => {
      await page.goto('/dashboard/billing');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('billing-page.png', {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator('time'),
          page.locator('[data-testid="usage-count"]'),
        ],
      });
    });

    test('settings page', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('settings-page.png', {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator('time'),
          page.locator('input[type="email"]'),
          page.locator('[data-testid="user-email"]'),
        ],
      });
    });
  });

  test.describe('Unauthenticated Pages', () => {
    test.beforeEach(async ({ page }) => {
      await dismissConsent(page);
    });

    test('login page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('login-page.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });
});
