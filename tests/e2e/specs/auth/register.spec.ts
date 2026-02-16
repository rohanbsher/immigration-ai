/**
 * Registration E2E Tests
 * Tests user registration with role selection (Attorney/Client).
 *
 * Test count: 4
 */

import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestId } from '../../fixtures/factories';

test.describe('Registration Flow', () => {
  test.describe('Role Selection', () => {
    test('should allow selecting Attorney role and show attorney fields', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      // Find and click Attorney option
      const attorneyButton = page.locator('button:has-text("Attorney")')
        .or(page.locator('[data-testid="role-attorney"]'))
        .or(page.locator('label:has-text("Attorney")'))
        .or(page.locator('text=Attorney'));

      await expect(attorneyButton.first()).toBeVisible();
      await attorneyButton.first().click();

      // Attorney-specific fields should appear
      const barNumberField = page.locator('input[placeholder*="bar number"]')
        .or(page.locator('input[name="barNumber"]'))
        .or(page.locator('label:has-text("Bar Number")'))
        .or(page.locator('[data-testid="bar-number"]'));

      await expect(barNumberField.first()).toBeVisible({ timeout: 5000 });
    });

    test('should allow selecting Client role', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      // Find and click Client option
      const clientButton = page.locator('button:has-text("Client")')
        .or(page.locator('[data-testid="role-client"]'))
        .or(page.locator('label:has-text("Client")'))
        .or(page.locator('text=Client'));

      await expect(clientButton.first()).toBeVisible();
      await clientButton.first().click();

      // Client should not see attorney-specific fields
      const barNumberField = page.locator('input[name="barNumber"]')
        .or(page.locator('[data-testid="bar-number"]'));

      // Bar number should not be visible for clients
      await page.waitForLoadState('domcontentloaded');
      const isBarVisible = await barNumberField.first().isVisible().catch(() => false);
      expect(isBarVisible).toBeFalsy();
    });
  });

  test.describe('Form Validation', () => {
    test('should validate password requirements', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      const passwordInput = page.locator('input[type="password"]')
        .or(page.locator('input[name="password"]'));

      // Enter weak password
      await passwordInput.first().fill('weak');
      await passwordInput.first().blur();

      // Should show password requirements or error
      const passwordError = page.locator('text=8 characters')
        .or(page.locator('text=uppercase'))
        .or(page.locator('text=number'))
        .or(page.locator('text=special'))
        .or(page.locator('[data-testid="password-error"]'))
        .or(page.locator('.text-red'));

      await expect(passwordError.first()).toBeVisible({ timeout: 5000 });
    });

    test('should prevent registration with existing email', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');

      // Use a common test email that likely exists
      const existingEmail = process.env.E2E_TEST_USER || 'test@example.com';

      const emailInput = page.locator('input[type="email"]')
        .or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[type="password"]')
        .or(page.locator('input[name="password"]'));
      const nameInput = page.locator('input[name="name"]')
        .or(page.locator('input[placeholder*="name"]'));

      // Fill the form
      if (await nameInput.first().isVisible()) {
        await nameInput.first().fill('Test User');
      }
      await emailInput.first().fill(existingEmail);
      await passwordInput.first().fill('ValidPassword123!');

      // Select a role if required
      const clientButton = page.locator('button:has-text("Client")');
      if (await clientButton.isVisible()) {
        await clientButton.click();
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button:has-text("Sign up")')
        .or(page.locator('button:has-text("Create account")')));
      await submitButton.first().click();

      // Should show error for existing email
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('text=already exists'))
        .or(page.locator('text=already registered'))
        .or(page.locator('text=email in use'))
        .or(page.locator('.text-red'))
        .or(page.locator('[data-sonner-toast]'));

      await expect(errorMessage.first()).toBeVisible({ timeout: 15000 });
    });
  });
});
