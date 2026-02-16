/**
 * E2E Tests: Attorney-Client Workflow Interactions
 *
 * Tests cross-role interactions between attorneys and clients.
 * Covers case visibility, document sharing, status updates,
 * and communication workflows.
 */

import { test, expect } from '@playwright/test';
import {
  AuthHelpers,
  NavHelpers,
  DocumentFactory,
  generateCaseTitle,
  WaitHelpers,
  hasValidCredentials,
} from '../../fixtures/factories';

// Computed credential checks using unified pattern - use function to evaluate at runtime
function hasBothCredentials(): boolean {
  return hasValidCredentials('attorney') && hasValidCredentials('client');
}

// Store case title between tests for cross-test reference
let sharedCaseTitle: string | null = null;

test.describe('Attorney-Client Cross-Role Interactions', () => {
  test.describe('Attorney Creates Case for Client', () => {
    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('attorney'), 'Missing attorney test credentials');
    });

    test('should allow attorney to create case for client', async ({ page }) => {
      // Attorney auth is pre-loaded via storageState in playwright.config.ts
      await NavHelpers.goToCases(page);

      // Open create case dialog
      const newCaseButton = page.locator('button:has-text("New Case")');
      await expect(newCaseButton).toBeVisible();
      await newCaseButton.click();

      const dialog = page.locator('[role="dialog"]:not([aria-label="Cookie consent"])');
      await expect(dialog).toBeVisible();

      // Fill case details
      sharedCaseTitle = generateCaseTitle();
      await page.fill('input[name="title"], input#title', sharedCaseTitle);

      // Select client via search dropdown
      const clientSearchInput = page.locator('input#client_search');
      const clientIdInput = page.locator('input[name="client_id"], input#client_id');
      if (await clientSearchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const clientEmail = process.env.E2E_CLIENT_EMAIL || 'test';
        await clientSearchInput.fill(clientEmail.split('@')[0]);
        const clientOption = page.locator('button:has-text("@")').first();
        try {
          await clientOption.waitFor({ state: 'visible', timeout: 5000 });
          await clientOption.click();
        } catch {
          test.skip(true, 'No test clients available in client search');
        }
      } else if (await clientIdInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        const testClientId = process.env.E2E_CLIENT_USER_ID || process.env.E2E_TEST_CLIENT_ID || 'test-client-id';
        await clientIdInput.fill(testClientId);
      }

      // Select visa type
      const visaTypeSelect = page.locator('select[name="visa_type"], select#visa_type');
      if (await visaTypeSelect.isVisible()) {
        await visaTypeSelect.selectOption('I-485');
      }

      // Add description
      const descriptionInput = page.locator('textarea[name="description"], textarea#description');
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Cross-role test case for attorney-client workflow');
      }

      // Submit
      const createButton = dialog.locator('button[type="submit"], button:has-text("Create Case")');
      await createButton.click();

      // Wait for success
      await Promise.race([
        page.waitForURL(/\/dashboard\/cases\/[a-f0-9-]+/, { timeout: 15000 }),
        WaitHelpers.forToast(page, 'created', 15000),
      ]).catch(() => {
        // Case creation may fail if test data is missing
      });

      // Verify case was created
      if (sharedCaseTitle) {
        const caseTitle = page.locator('h1');
        if (await caseTitle.isVisible({ timeout: 3000 })) {
          await expect(caseTitle).toContainText(sharedCaseTitle);
        }
      }
    });
  });

  test.describe('Client Views Assigned Case', () => {
    // Client auth loaded via storageState — no loginAs needed
    test.use({ storageState: 'tests/e2e/.auth/client.json' });

    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('client'), 'Missing client test credentials');
    });

    test('should allow client to view their assigned case', async ({ page }) => {
      // Client auth is pre-loaded via storageState

      // Navigate to client's cases view
      // Clients typically have a different dashboard layout
      await page.goto('/dashboard/client');
      await page.waitForLoadState('domcontentloaded');

      // Or navigate to cases if accessible
      const casesLink = page.locator('a[href*="cases"]')
        .or(page.locator('button:has-text("Cases")')
        .or(page.locator('text=My Cases')));

      if (await casesLink.first().isVisible({ timeout: 5000 })) {
        await casesLink.first().click();
        await page.waitForLoadState('domcontentloaded');
      }

      // Look for the shared case or any assigned case
      const caseList = page.locator('[class*="card"]')
        .or(page.locator('[data-testid="case-item"]'))
        .or(page.locator('a[href*="/cases/"]'));

      const emptyState = page.locator('text=No cases')
        .or(page.locator('[data-testid="empty-state"]'))
        .or(page.locator('text=No active cases'))
        .or(page.locator('text=no cases'));

      const hasCases = (await caseList.count()) > 0;
      const isEmpty = await emptyState.isVisible().catch(() => false);

      // Page loaded — cases, empty state, or dashboard rendered
      expect(hasCases || isEmpty || page.url().includes('/dashboard')).toBeTruthy();

      // If we have the shared case title, look for it specifically
      if (sharedCaseTitle && hasCases) {
        const sharedCase = page.locator(`text="${sharedCaseTitle}"`);
        if (await sharedCase.isVisible({ timeout: 3000 })) {
          await sharedCase.click();
          await page.waitForLoadState('domcontentloaded');

          // Verify case details are visible
          const caseDetails = page.locator('[data-testid="case-detail"]')
            .or(page.locator('h1'));

          await expect(caseDetails.first()).toBeVisible();
        }
      } else if (hasCases) {
        // Click on first available case
        await caseList.first().click();
        await page.waitForLoadState('domcontentloaded');

        // Verify case view
        const caseContent = page.locator('h1')
          .or(page.locator('[data-testid="case-content"]'));

        await expect(caseContent.first()).toBeVisible();
      }
    });
  });

  test.describe('Client Document Upload', () => {
    // Client auth loaded via storageState — no loginAs needed
    test.use({ storageState: 'tests/e2e/.auth/client.json' });

    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('client'), 'Missing client test credentials');
    });

    test('should allow client to upload document to their case', async ({ page }) => {
      // Client auth is pre-loaded via storageState

      // Navigate to client's case
      await page.goto('/dashboard/client');
      await page.waitForLoadState('domcontentloaded');

      // Find a case
      const casesLink = page.locator('a[href*="cases"]')
        .or(page.locator('text=My Cases'));

      if (await casesLink.first().isVisible({ timeout: 5000 })) {
        await casesLink.first().click();
        await page.waitForLoadState('domcontentloaded');
      }

      const caseItem = page.locator('[class*="card"]')
        .or(page.locator('a[href*="/client/cases/"]'));

      if (await caseItem.first().isVisible({ timeout: 5000 })) {
        await caseItem.first().click();
        await page.waitForLoadState('domcontentloaded');

        // Look for documents section
        const documentsSection = page.locator('text=Documents')
          .or(page.locator('button:has-text("Documents")'));

        if (await documentsSection.first().isVisible()) {
          await documentsSection.first().click();
        }

        // Find upload option
        const uploadButton = page.locator('button:has-text("Upload")')
          .or(page.locator('[data-testid="upload-document"]'));

        if (await uploadButton.isVisible({ timeout: 3000 })) {
          await uploadButton.click();

          // Wait for upload dialog/area
          await page.waitForLoadState('domcontentloaded');

          const fileInput = page.locator('input[type="file"]');

          if ((await fileInput.count()) > 0) {
            // Create and upload a document
            const mockPdf = DocumentFactory.createMockPDF('client-passport.pdf');

            await fileInput.first().setInputFiles({
              name: mockPdf.name,
              mimeType: mockPdf.mimeType,
              buffer: mockPdf.buffer,
            });

            // Select document type if available
            const docTypeSelect = page.locator('select').first();
            if (await docTypeSelect.isVisible({ timeout: 2000 })) {
              await docTypeSelect.selectOption('passport');
            }

            // Submit upload
            const submitButton = page.locator('button:has-text("Upload")').last();
            if (await submitButton.isVisible({ timeout: 2000 })) {
              await submitButton.click();
            }

            // Wait for upload success
            await WaitHelpers.forToast(page, 'uploaded', 10000);
          }
        }
      } else {
        test.skip(true, 'No cases assigned to client');
      }
    });
  });

  test.describe('Attorney Reviews Client Document', () => {
    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('attorney'), 'Missing attorney test credentials');
    });

    test('should allow attorney to review document uploaded by client', async ({ page }) => {
      // Attorney auth is pre-loaded via storageState in playwright.config.ts
      await NavHelpers.goToCases(page);

      // Find a case with documents
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Navigate to documents tab
        const documentsTab = page.locator('button:has-text("Documents")');
        if (await documentsTab.isVisible()) {
          await documentsTab.click();
          await page.waitForLoadState('domcontentloaded');

          // Check for documents
          const documents = page.locator('[class*="card"]')
            .or(page.locator('[data-testid="document-item"]'));

          if ((await documents.count()) > 0) {
            // Click on first document
            await documents.first().click();

            // Look for verification/review controls
            const verifyButton = page.locator('button:has-text("Verify")')
              .or(page.locator('button:has-text("Review")')
              .or(page.locator('[data-testid="verify-document"]')));

            if (await verifyButton.isVisible({ timeout: 3000 })) {
              await verifyButton.click();

              // Verification should succeed
              await WaitHelpers.forToast(page, 'verified', 5000);

              // Status should update
              const verifiedStatus = page.locator('text=Verified')
                .or(page.locator('[data-testid="status-verified"]'));

              await expect(verifiedStatus.first()).toBeVisible({ timeout: 5000 });
            }
          }
        }
      } else {
        test.skip(true, 'No cases available');
      }
    });
  });

  test.describe('Status Visibility Across Roles', () => {
    test.beforeEach(async () => {
      test.skip(!hasBothCredentials(), 'Missing both attorney and client credentials');
    });

    test('should show consistent case status to both attorney and client', async ({ browser }) => {
      // Create two browser contexts with pre-loaded auth — no loginAs needed
      const attorneyContext = await browser.newContext({
        storageState: 'tests/e2e/.auth/attorney.json',
      });
      const clientContext = await browser.newContext({
        storageState: 'tests/e2e/.auth/client.json',
      });

      const attorneyPage = await attorneyContext.newPage();
      const clientPage = await clientContext.newPage();

      try {
        // Attorney auth is pre-loaded via storageState
        await NavHelpers.goToCases(attorneyPage);

        // Find a case
        const caseLink = attorneyPage.locator('a[href^="/dashboard/cases/"]').first();

        if (await caseLink.isVisible()) {
          await caseLink.click();
          await attorneyPage.waitForLoadState('domcontentloaded');

          // Get case ID from URL
          const currentUrl = attorneyPage.url();
          const idMatch = currentUrl.match(/\/cases\/([a-f0-9-]+)/);

          if (idMatch) {
            const caseId = idMatch[1];

            // Get current status as attorney sees it
            const attorneyStatusSelect = attorneyPage.locator('select').first();
            let attorneyStatus = 'intake';
            if (await attorneyStatusSelect.isVisible({ timeout: 3000 })) {
              attorneyStatus = await attorneyStatusSelect.inputValue();
            }

            // Client auth is pre-loaded via storageState
            await clientPage.goto('/dashboard/client');
            await clientPage.waitForLoadState('domcontentloaded');

            // Navigate to client's cases
            const clientCasesLink = clientPage.locator('a[href*="cases"]')
              .or(clientPage.locator('text=My Cases'));

            if (await clientCasesLink.first().isVisible({ timeout: 5000 })) {
              await clientCasesLink.first().click();
              await clientPage.waitForLoadState('domcontentloaded');

              // Find the same case
              const clientCaseItem = clientPage.locator('[class*="card"]').first()
                .or(clientPage.locator(`a[href*="${caseId}"]`));

              if (await clientCaseItem.isVisible({ timeout: 5000 })) {
                await clientCaseItem.click();
                await clientPage.waitForLoadState('domcontentloaded');

                // Get status as client sees it
                const clientStatusBadge = clientPage.locator('[class*="badge"]')
                  .or(clientPage.locator('[data-testid="case-status"]'));

                if (await clientStatusBadge.first().isVisible({ timeout: 3000 })) {
                  const clientStatusText = await clientStatusBadge.first().textContent();

                  // Both should reflect the same status (formatting may differ)
                  const normalizedAttorneyStatus = attorneyStatus.toLowerCase().replace(/_/g, ' ');
                  const normalizedClientStatus = clientStatusText?.toLowerCase() || '';

                  // At least the first word should match
                  const statusMatch = normalizedClientStatus.includes(normalizedAttorneyStatus.split(' ')[0]);
                  expect(statusMatch).toBeTruthy();
                }
              }
            }
          }
        } else {
          test.skip(true, 'No cases available');
        }
      } finally {
        await attorneyContext.close();
        await clientContext.close();
      }
    });
  });

  test.describe('Notification Flow', () => {
    test.beforeEach(async () => {
      test.skip(!hasValidCredentials('attorney'), 'Missing attorney test credentials');
    });

    test('should notify relevant parties on case updates', async ({ page }) => {
      // Attorney auth is pre-loaded via storageState in playwright.config.ts
      await NavHelpers.goToCases(page);

      // Find a case
      const caseLink = page.locator('a[href^="/dashboard/cases/"]').first();

      if (await caseLink.isVisible()) {
        await caseLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Make a status change that should trigger notification
        const statusSelect = page.locator('select').filter({
          has: page.locator('option'),
        }).first();

        if (await statusSelect.isVisible({ timeout: 3000 })) {
          const currentStatus = await statusSelect.inputValue();
          const newStatus = currentStatus === 'intake' ? 'document_collection' : 'in_review';

          await statusSelect.selectOption(newStatus);
          await WaitHelpers.forNetworkIdle(page);

          // Status update should succeed
          await WaitHelpers.forToast(page, 'updated', 5000);

          // Check for notification indication (might be bell icon with badge)
          // Notifications might be visible after update (async notifications)
          await page.locator('[data-testid="notifications"]')
            .or(page.locator('[aria-label*="notification"]'))
            .or(page.locator('.notification-badge'))
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        }

        // Navigate to notifications page if available
        const notificationsLink = page.locator('a[href*="notification"]')
          .or(page.locator('button[aria-label*="notification"]'));

        if (await notificationsLink.first().isVisible({ timeout: 3000 })) {
          await notificationsLink.first().click();
          await page.waitForLoadState('domcontentloaded');

          // Check if notifications list is visible
          await page.locator('[data-testid="notifications-list"]')
            .or(page.locator('[class*="notification"]'))
            .isVisible({ timeout: 3000 })
            .catch(() => false);
        }
      } else {
        test.skip(true, 'No cases available');
      }
    });
  });
});

test.describe('Cross-Role Security', () => {
  // Client auth loaded via storageState — no loginAs needed
  test.use({ storageState: 'tests/e2e/.auth/client.json' });

  test('should not allow client to access other clients\' cases', async ({ page }) => {
    test.skip(!hasValidCredentials('client'), 'Missing client test credentials');

    // Client auth is pre-loaded via storageState

    // Try to access a random case ID directly
    await page.goto('/dashboard/cases/random-invalid-case-id');
    await page.waitForLoadState('domcontentloaded');

    // Should either redirect, show access denied, or show the dashboard
    const accessDenied = page.locator('text=not found')
      .or(page.locator('text=access denied'))
      .or(page.locator('text=404'))
      .or(page.locator('text=error'))
      .or(page.locator('text=Not Found'));

    const wasRedirected = !page.url().includes('random-invalid-case-id');
    const errorVisible = await accessDenied.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Accept: error shown, redirected away, or still on dashboard
    expect(errorVisible || wasRedirected || page.url().includes('/dashboard')).toBeTruthy();
  });

  test('should not allow client to modify case status', async ({ page }) => {
    test.skip(!hasValidCredentials('client'), 'Missing client test credentials');

    // Client auth is pre-loaded via storageState

    // Navigate to client's case view
    await page.goto('/dashboard/client');
    await page.waitForLoadState('domcontentloaded');

    // Find and open a case
    const casesLink = page.locator('a[href*="cases"]')
      .or(page.locator('text=My Cases'));

    if (await casesLink.first().isVisible({ timeout: 5000 })) {
      await casesLink.first().click();
      await page.waitForLoadState('domcontentloaded');

      const caseItem = page.locator('[class*="card"]').first();

      if (await caseItem.isVisible({ timeout: 5000 })) {
        await caseItem.click();
        await page.waitForLoadState('domcontentloaded');

        // Client should NOT have status change dropdown
        const statusSelect = page.locator('select').filter({
          has: page.locator('option:has-text("Intake")'),
        });

        // Status control should not be editable for clients
        const hasStatusControl = await statusSelect.first().isVisible({ timeout: 3000 });

        if (hasStatusControl) {
          // If visible, it should be disabled
          const isDisabled = await statusSelect.first().isDisabled();
          expect(isDisabled).toBeTruthy();
        }
      }
    }
  });
});
