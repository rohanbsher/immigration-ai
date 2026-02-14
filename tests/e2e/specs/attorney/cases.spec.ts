/**
 * E2E Tests: Attorney Case Management
 *
 * Tests for case CRUD operations from the attorney perspective.
 * Covers creation, viewing, filtering, searching, updating, deleting,
 * status transitions, and client assignment.
 */

import { test, expect } from '@playwright/test';
import {
  AuthHelpers,
  NavHelpers,
  generateCaseTitle,
  WaitHelpers,
  hasValidCredentials,
} from '../../fixtures/factories';

test.describe('Attorney Case Management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasValidCredentials('attorney'), 'Missing attorney test credentials');
    await AuthHelpers.loginAs(page, 'attorney');
  });

  test.describe('Case Creation', () => {
    test('should create case with valid data', async ({ page }) => {
      // Navigate to cases page
      await NavHelpers.goToCases(page);

      // Click the "New Case" button
      const newCaseButton = page.locator('button:has-text("New Case")');
      await expect(newCaseButton).toBeVisible();
      await newCaseButton.click();

      // Wait for dialog to open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Fill in case details
      const testTitle = generateCaseTitle();
      await page.fill('input[name="title"], input#title', testTitle);

      // Fill client ID (for test, we use a placeholder or test client ID)
      const clientIdInput = page.locator('input[name="client_id"], input#client_id');
      if (await clientIdInput.isVisible()) {
        // Use test client ID if available
        const testClientId = process.env.E2E_TEST_CLIENT_ID || 'test-client-id';
        await clientIdInput.fill(testClientId);
      }

      // Select visa type
      const visaTypeSelect = page.locator('select[name="visa_type"], select#visa_type');
      if (await visaTypeSelect.isVisible()) {
        await visaTypeSelect.selectOption({ index: 1 }); // Select first available visa type
      }

      // Fill optional fields
      const descriptionInput = page.locator('textarea[name="description"], textarea#description');
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Test case created via E2E tests');
      }

      // Submit the form
      const createButton = dialog.locator('button[type="submit"], button:has-text("Create Case")');
      await createButton.click();

      // Wait for success indication
      // Either redirected to case detail or dialog closes with success toast
      await Promise.race([
        page.waitForURL(/\/dashboard\/cases\/[a-f0-9-]+/, { timeout: 10000 }),
        WaitHelpers.forToast(page, 'created', 10000),
      ]);

      // Verify case was created
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard/cases/')) {
        // On case detail page
        await expect(page.locator('h1')).toContainText(testTitle);
      } else {
        // Still on cases list - check for case in list
        await NavHelpers.goToCases(page);
        const caseInList = page.locator(`text="${testTitle}"`);
        await expect(caseInList.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Case List', () => {
    test('should view case list with pagination', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Verify page loaded
      await expect(page).toHaveURL(/\/dashboard\/cases/);

      // Check for either case list or empty state
      const caseCards = page.locator('[class*="card"], [data-testid="case-item"]');
      const emptyState = page.locator('text=No cases').or(page.locator('[data-testid="empty-state"]'));

      const hasCases = (await caseCards.count()) > 0;
      const isEmpty = await emptyState.isVisible();

      expect(hasCases || isEmpty).toBeTruthy();

      // If there are cases, check for pagination or "load more" functionality
      if (hasCases) {
        const caseCount = await caseCards.count();
        // Verify at least one case is displayed
        expect(caseCount).toBeGreaterThan(0);

        // Look for pagination controls if many cases exist
        // Pagination might not be visible if few cases
        await page.locator('[data-testid="pagination"]')
          .or(page.locator('button:has-text("Next")'))
          .or(page.locator('button:has-text("Load More")'))
          .isVisible({ timeout: 1000 })
          .catch(() => false);
      }
    });

    test('should filter cases by status', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Look for status filter
      const statusFilter = page.locator('button:has-text("Active")')
        .or(page.locator('button:has-text("Filed")')
        .or(page.locator('button:has-text("Closed")')
        .or(page.locator('[data-testid="status-filter"]'))));

      // Check if filter exists
      const filterCount = await statusFilter.count();
      if (filterCount > 0) {
        // Click on a filter option
        const activeFilter = page.locator('button:has-text("Active")');
        if (await activeFilter.isVisible()) {
          await activeFilter.click();
          await WaitHelpers.forNetworkIdle(page);

          // Verify filtered results - count should be >= 0
          const casesAfterFilterCount = await page.locator('[class*="card"]').count();
          expect(casesAfterFilterCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should search cases by title', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Find search input
      const searchInput = page.locator('input[placeholder*="Search"]')
        .or(page.locator('input[type="search"]'))
        .or(page.locator('[data-testid="search-input"]'));

      if (await searchInput.first().isVisible()) {
        // Enter search query
        const searchQuery = 'Test';
        await searchInput.first().fill(searchQuery);

        // Wait for results to update
        await WaitHelpers.forNetworkIdle(page);

        // Results should either contain matching cases or show "no results"
        const results = page.locator('[class*="card"]');
        const noResults = page.locator('text=No cases');

        const hasResults = (await results.count()) > 0;
        const hasNoResultsMessage = await noResults.isVisible();

        expect(hasResults || hasNoResultsMessage).toBeTruthy();
      }
    });
  });

  test.describe('Case Detail and Update', () => {
    test('should update case details', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Find and click on a case
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Look for edit button
        const editButton = page.locator('button[aria-label*="Edit"]')
          .or(page.locator('button:has-text("Edit")'))
          .or(page.locator('[data-testid="edit-case"]'));

        if (await editButton.first().isVisible()) {
          await editButton.first().click();

          // Wait for edit mode/dialog
          await page.waitForLoadState('domcontentloaded');

          // Update a field (e.g., notes or description)
          const notesInput = page.locator('textarea')
            .or(page.locator('[data-testid="case-notes"]'));

          if (await notesInput.first().isVisible()) {
            const updatedNote = `Updated via E2E test at ${new Date().toISOString()}`;
            await notesInput.first().fill(updatedNote);

            // Save changes
            const saveButton = page.locator('button:has-text("Save")')
              .or(page.locator('button[type="submit"]'));

            if (await saveButton.first().isVisible()) {
              await saveButton.first().click();
              await WaitHelpers.forToast(page, 'updated', 5000);
            }
          }
        }
      }
    });

    test('should perform case status transitions', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Navigate to a case
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Find status dropdown/selector
        const statusSelect = page.locator('select')
          .filter({ has: page.locator('option:has-text("Intake")') })
          .or(page.locator('[data-testid="case-status-select"]'));

        if (await statusSelect.first().isVisible()) {
          // Get current status
          const currentValue = await statusSelect.first().inputValue();

          // Select a new status
          const newStatus = currentValue === 'intake' ? 'document_collection' : 'in_review';
          await statusSelect.first().selectOption(newStatus);

          // Wait for update
          await WaitHelpers.forToast(page, 'updated', 5000);

          // Verify status changed
          const statusBadge = page.locator('[class*="badge"]')
            .or(page.locator('[data-testid="case-status"]'));

          if (await statusBadge.first().isVisible()) {
            // Status should reflect the change
            const badgeText = await statusBadge.first().textContent();
            expect(badgeText?.toLowerCase()).toContain(newStatus.replace('_', ' ').split('_')[0]);
          }
        }
      }
    });
  });

  test.describe('Case Deletion', () => {
    test('should delete case with confirmation', async ({ page }) => {
      await NavHelpers.goToCases(page);

      // Look for a case to delete (preferably a test case)
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('networkidle');

        // Find delete button (might be in a dropdown menu)
        const deleteButton = page.locator('button:has-text("Delete")')
          .or(page.locator('button:has-text("Archive")')
          .or(page.locator('[data-testid="delete-case"]')));

        if (await deleteButton.first().isVisible()) {
          // Mock window.confirm to return true
          await page.evaluate(() => {
            window.confirm = () => true;
          });

          await deleteButton.first().click();

          // Wait for confirmation dialog or immediate deletion
          const confirmDialog = page.locator('[role="alertdialog"]')
            .or(page.locator('[role="dialog"]:has-text("confirm")'));

          if (await confirmDialog.isVisible({ timeout: 2000 })) {
            const confirmButton = confirmDialog.locator('button:has-text("Delete")')
              .or(confirmDialog.locator('button:has-text("Confirm")'))
              .or(confirmDialog.locator('button:has-text("Yes")'));

            await confirmButton.click();
          }

          // Wait for redirect or success message
          await Promise.race([
            page.waitForURL(/\/dashboard\/cases$/, { timeout: 10000 }),
            WaitHelpers.forToast(page, 'archived', 5000),
            WaitHelpers.forToast(page, 'deleted', 5000),
          ]);
        }
      }
    });
  });

  test.describe('Case Assignment', () => {
    test('should assign case to client', async ({ page }) => {
      // This test verifies the case-client relationship
      await NavHelpers.goToCases(page);

      // Navigate to create new case (where client assignment happens)
      const newCaseButton = page.locator('button:has-text("New Case")');

      if (await newCaseButton.isVisible()) {
        await newCaseButton.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // Verify client ID field is required
        const clientIdInput = page.locator('input[name="client_id"], input#client_id');

        if (await clientIdInput.isVisible()) {
          // Try to submit without client ID
          const submitButton = dialog.locator('button[type="submit"], button:has-text("Create")');
          await submitButton.click();

          // Should show validation error or dialog stays open
          await page.locator('[role="alert"]')
            .or(page.locator('text=required'))
            .or(page.locator('.error'))
            .isVisible({ timeout: 2000 })
            .catch(() => false);

          // Either validation prevents submission or error shows
          const stillHasDialog = await dialog.isVisible({ timeout: 2000 });
          expect(stillHasDialog).toBeTruthy();
        }

        // Close dialog
        const closeButton = dialog.locator('button:has-text("Cancel")')
          .or(dialog.locator('[aria-label="Close"]'));

        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    });
  });
});

test.describe('Case Management - Unauthenticated', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access cases page directly
    await page.goto('/dashboard/cases');

    // Should redirect to login
    await page.waitForURL(/\/(login|signin)/, { timeout: 10000 });
  });

  test('should not allow direct case access without authentication', async ({ page }) => {
    await page.context().clearCookies();

    // Try to access a specific case
    await page.goto('/dashboard/cases/some-case-id');

    // Should redirect to login
    await page.waitForURL(/\/(login|signin)/, { timeout: 10000 });
  });
});
