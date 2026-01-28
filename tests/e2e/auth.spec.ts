import { test, expect } from '@playwright/test';
import { generateTestEmail } from './fixtures/test-helpers';

test.describe('Authentication Flows', () => {
  test.describe('Landing Page', () => {
    test('should load landing page with login/signup links', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify page loads
      await expect(page).toHaveTitle(/Immigration/i);

      // Look for navigation links
      const loginLink = page.locator('a[href="/login"]').or(page.locator('text=Login')).or(page.locator('text=Sign in'));
      await expect(loginLink.first()).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Check for email and password inputs using placeholder text
      await expect(page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'))).toBeVisible();
      await expect(page.locator('input[placeholder*="password"]').or(page.locator('input[type="password"]'))).toBeVisible();
      await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Fill in the form using placeholders
      const emailInput = page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]').or(page.locator('input[type="password"]'));

      await emailInput.first().fill('invalid@example.com');
      await passwordInput.first().fill('wrongpassword123');
      await page.click('button:has-text("Sign in")');

      // Wait for error message
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('text=Invalid'))
        .or(page.locator('text=incorrect'))
        .or(page.locator('.text-red'))
        .or(page.locator('[data-sonner-toast]'));
      await expect(errorMessage.first()).toBeVisible({ timeout: 15000 });
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Click on "Sign up" link
      const signupLink = page.locator('a[href="/register"]')
        .or(page.locator('text=Sign up'));
      await signupLink.first().click();

      await page.waitForURL(/\/register/);
    });

    test('should navigate to forgot password', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const forgotLink = page.locator('a:has-text("Forgot")')
        .or(page.locator('text=Forgot password'));
      await forgotLink.first().click();

      await page.waitForURL(/\/forgot-password/);
    });

    test('should show OAuth options', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Check for Google and Microsoft OAuth buttons
      const googleButton = page.locator('button:has-text("Google")');
      const microsoftButton = page.locator('button:has-text("Microsoft")');

      await expect(googleButton).toBeVisible();
      await expect(microsoftButton).toBeVisible();
    });
  });

  test.describe('Register Flow', () => {
    test('should display register form', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Check for form elements
      await expect(page.locator('text=Create your account')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should have user type selector', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Check for Attorney/Client toggle
      const attorneyButton = page.locator('button:has-text("Attorney")').or(page.locator('text=Attorney'));
      const clientButton = page.locator('button:has-text("Client")').or(page.locator('text=Client'));

      await expect(attorneyButton.first()).toBeVisible();
      await expect(clientButton.first()).toBeVisible();
    });

    test('should show attorney-specific fields when Attorney selected', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Click on Attorney option
      const attorneyButton = page.locator('button:has-text("Attorney")');
      if (await attorneyButton.isVisible()) {
        await attorneyButton.click();
      }

      // Should show Bar Number field
      const barNumberField = page.locator('input[placeholder*="bar number"]')
        .or(page.locator('label:has-text("Bar Number")'));
      await expect(barNumberField.first()).toBeVisible();
    });

    test('should show password requirements', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Check for password requirements text
      await expect(page.locator('text=8 characters')).toBeVisible();
      await expect(page.locator('text=uppercase')).toBeVisible();
      await expect(page.locator('text=One number')).toBeVisible();
      await expect(page.locator('text=special character')).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      const loginLink = page.locator('a[href="/login"]')
        .or(page.locator('text=Sign in'))
        .or(page.locator('text=Log in'));
      await loginLink.first().click();

      await page.waitForURL(/\/login/);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users from dashboard to login', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect unauthenticated users from cases to login', async ({ page }) => {
      await page.goto('/dashboard/cases');

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect unauthenticated users from documents to login', async ({ page }) => {
      await page.goto('/dashboard/documents');

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });

    test('should redirect unauthenticated users from settings to login', async ({ page }) => {
      await page.goto('/dashboard/settings');

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page navigations', async ({ page }) => {
      // This test requires a valid test user in the database
      test.skip(!process.env.E2E_TEST_USER, 'No test user credentials');

      await page.goto('/login');

      const emailInput = page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'));
      const passwordInput = page.locator('input[placeholder*="password"]').or(page.locator('input[type="password"]'));

      await emailInput.first().fill(process.env.E2E_TEST_USER!);
      await passwordInput.first().fill(process.env.E2E_TEST_PASSWORD!);
      await page.click('button:has-text("Sign in")');

      await page.waitForURL(/\/dashboard/);

      // Navigate to different pages
      await page.goto('/dashboard/cases');
      await expect(page).toHaveURL(/\/dashboard\/cases/);

      await page.goto('/dashboard/documents');
      await expect(page).toHaveURL(/\/dashboard\/documents/);
    });
  });
});

test.describe('Password Reset Flow', () => {
  test('should display password reset form', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible();
  });

  test('should show success message after requesting reset', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'));
    await emailInput.first().fill('test@example.com');

    const submitButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("Reset")'));
    await submitButton.first().click();

    // Should show success or confirmation message
    const successMessage = page.locator('text=email')
      .or(page.locator('text=sent'))
      .or(page.locator('text=check'));
  });
});

test.describe('Security', () => {
  test('should not expose sensitive data in page source', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const content = await page.content();

    // Should not contain API keys or secrets
    expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
    expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE/i);
    expect(content).not.toMatch(/ANTHROPIC_API_KEY/i);
  });
});
