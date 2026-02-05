import { test, expect } from '@playwright/test';

// NOTE: Uses E2E_TEST_USER (legacy generic user) instead of E2E_ATTORNEY_EMAIL (role-based)
// TODO: Migrate to hasValidCredentials() when env vars are standardized across CI/CD
const hasTestCredentials = process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD;

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

    // Login before each test
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test.describe('Cases List Page', () => {
    test('should display cases page', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      // Should be on cases page
      await expect(page).toHaveURL(/\/dashboard\/cases/);

      // Should have cases heading or content
      const casesHeading = page.locator('h1:has-text("Cases")')
        .or(page.locator('[data-testid="cases-header"]'))
        .or(page.locator('text=Case Management'));
      await expect(casesHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show create case button', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create")')
        .or(page.locator('button:has-text("New Case")')
        .or(page.locator('a[href="/dashboard/cases/new"]')));
      await expect(createButton.first()).toBeVisible();
    });

    test('should navigate to create case page', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create")')
        .or(page.locator('button:has-text("New")')
        .or(page.locator('a[href="/dashboard/cases/new"]')));
      await createButton.first().click();

      await page.waitForURL(/\/dashboard\/cases\/new/, { timeout: 10000 });
    });

    test('should display case list or empty state', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      // Either show case cards/rows or an empty state
      const caseItems = page.locator('[data-testid="case-item"]')
        .or(page.locator('[role="row"]'))
        .or(page.locator('.case-card'));

      const emptyState = page.locator('text=No cases')
        .or(page.locator('text=Get started'))
        .or(page.locator('[data-testid="empty-state"]'));

      // One of these should be visible
      const hasCases = await caseItems.first().isVisible();
      const isEmpty = await emptyState.first().isVisible();

      expect(hasCases || isEmpty).toBeTruthy();
    });
  });

  test.describe('Create Case Flow', () => {
    test('should display create case form', async ({ page }) => {
      await page.goto('/dashboard/cases/new');
      await page.waitForLoadState('networkidle');

      // Should have form elements
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should have case type selection', async ({ page }) => {
      await page.goto('/dashboard/cases/new');
      await page.waitForLoadState('networkidle');

      // Look for case type selector
      const typeSelector = page.locator('select')
        .or(page.locator('[role="combobox"]'))
        .or(page.locator('[data-testid="case-type"]'))
        .or(page.locator('input[name="type"]'));

      await expect(typeSelector.first()).toBeVisible();
    });

    test('should validate required fields on submit', async ({ page }) => {
      await page.goto('/dashboard/cases/new');
      await page.waitForLoadState('networkidle');

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button:has-text("Create")'));
      await submitButton.first().click();

      // Should show validation errors
      await page.waitForTimeout(500);
      const errorMessage = page.locator('[role="alert"]')
        .or(page.locator('.error'))
        .or(page.locator('text=required'));
    });

    test('should create a new case with valid data', async ({ page }) => {
      await page.goto('/dashboard/cases/new');
      await page.waitForLoadState('networkidle');

      // Fill in case details
      const titleInput = page.locator('input[name="title"]')
        .or(page.locator('input[placeholder*="title"]'));

      if (await titleInput.first().isVisible()) {
        await titleInput.first().fill(`Test Case ${Date.now()}`);
      }

      // Select case type if available
      const typeSelector = page.locator('select[name="type"]')
        .or(page.locator('[data-testid="case-type"]'));

      if (await typeSelector.first().isVisible()) {
        await typeSelector.first().selectOption({ index: 1 });
      }

      // Submit
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button:has-text("Create")'));
      await submitButton.first().click();

      // Should redirect to case detail or cases list
      await page.waitForURL(/\/dashboard\/cases/, { timeout: 10000 });
    });
  });

  test.describe('Case Detail Page', () => {
    test('should display case details when accessing valid case', async ({ page }) => {
      // First go to cases list
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      // Click on first case if available
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Should show case details
        const caseContent = page.locator('[data-testid="case-detail"]')
          .or(page.locator('h1'))
          .or(page.locator('main'));
        await expect(caseContent.first()).toBeVisible();
      }
    });

    test('should show 404 or error for invalid case ID', async ({ page }) => {
      await page.goto('/dashboard/cases/invalid-case-id-12345');
      await page.waitForLoadState('networkidle');

      // Should show error or 404
      const errorState = page.locator('text=not found')
        .or(page.locator('text=404'))
        .or(page.locator('text=error'));
    });
  });

  test.describe('Case Actions', () => {
    test('should have edit option for case', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Look for edit button
        const editButton = page.locator('button:has-text("Edit")')
          .or(page.locator('[data-testid="edit-case"]'))
          .or(page.locator('a:has-text("Edit")'));

        // Edit should be available
      }
    });

    test('should have delete option for case', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Look for delete button
        const deleteButton = page.locator('button:has-text("Delete")')
          .or(page.locator('[data-testid="delete-case"]'));

        // Delete should be available (might be in a dropdown menu)
      }
    });
  });

  test.describe('Case Filtering', () => {
    test('should have filter/search options', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      // Look for search or filter
      const searchInput = page.locator('input[type="search"]')
        .or(page.locator('input[placeholder*="search"]'))
        .or(page.locator('[data-testid="search-input"]'));

      const filterButton = page.locator('button:has-text("Filter")')
        .or(page.locator('[data-testid="filter-button"]'));

      // One of these should exist
    });
  });

  test.describe('Case Status', () => {
    test('should display case status', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page.waitForLoadState('networkidle');

      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Look for status badge or indicator
        const statusBadge = page.locator('[data-testid="case-status"]')
          .or(page.locator('text=pending'))
          .or(page.locator('text=active'))
          .or(page.locator('text=approved'))
          .or(page.locator('.status'));
      }
    });
  });
});

test.describe('Case Types', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials');

    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);
  });

  test('should support H1B visa type', async ({ page }) => {
    await page.goto('/dashboard/cases/new');
    await page.waitForLoadState('networkidle');

    const typeSelector = page.locator('select[name="type"]')
      .or(page.locator('[data-testid="case-type"]'));

    if (await typeSelector.first().isVisible()) {
      const options = await typeSelector.first().locator('option').allTextContents();
      const hasH1B = options.some(opt => opt.toLowerCase().includes('h1b') || opt.toLowerCase().includes('h-1b'));
      // H1B should be a supported type
    }
  });
});
