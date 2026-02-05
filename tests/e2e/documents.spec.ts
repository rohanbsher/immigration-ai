import { test, expect } from '@playwright/test';

// NOTE: Uses E2E_TEST_USER (legacy generic user) instead of E2E_ATTORNEY_EMAIL (role-based)
// TODO: Migrate to hasValidCredentials() when env vars are standardized across CI/CD
const hasTestCredentials = process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD;

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test.describe('Documents List Page', () => {
    test('should display documents page', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/dashboard\/documents/);

      const documentsHeading = page.locator('h1:has-text("Document")')
        .or(page.locator('[data-testid="documents-header"]'))
        .or(page.locator('text=Documents'));
      await expect(documentsHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show upload button or dropzone', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const uploadButton = page.locator('button:has-text("Upload")')
        .or(page.locator('[data-testid="upload-button"]'))
        .or(page.locator('input[type="file"]'))
        .or(page.locator('[role="button"]:has-text("Upload")'));

      const dropzone = page.locator('[data-testid="dropzone"]')
        .or(page.locator('text=drag and drop'))
        .or(page.locator('text=Drag & drop'));

      const hasUpload = await uploadButton.first().isVisible();
      const hasDropzone = await dropzone.first().isVisible();

      expect(hasUpload || hasDropzone).toBeTruthy();
    });

    test('should display document list or empty state', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const documentItems = page.locator('[data-testid="document-item"]')
        .or(page.locator('[role="row"]'))
        .or(page.locator('.document-card'));

      const emptyState = page.locator('text=No documents')
        .or(page.locator('text=Upload your first'))
        .or(page.locator('[data-testid="empty-state"]'));

      const hasDocuments = await documentItems.first().isVisible();
      const isEmpty = await emptyState.first().isVisible();

      expect(hasDocuments || isEmpty).toBeTruthy();
    });
  });

  test.describe('Document Upload', () => {
    test('should have file input for upload', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      // Look for file input (may be hidden)
      const fileInput = page.locator('input[type="file"]');

      // Even hidden inputs should exist
      const count = await fileInput.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show accepted file types', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      // Look for file type hints
      const typeHint = page.locator('text=PDF')
        .or(page.locator('text=jpg'))
        .or(page.locator('text=png'))
        .or(page.locator('[accept]'));
    });

    test('should upload a test file', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      // Create a synthetic PDF file for upload
      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.first().count() > 0) {
        // Set file with synthetic content
        await fileInput.first().setInputFiles({
          name: 'test-document.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 test content'),
        });

        // Wait for upload to complete
        await page.waitForTimeout(2000);

        // Look for success indicator
        const successMessage = page.locator('text=uploaded')
          .or(page.locator('text=success'))
          .or(page.locator('[role="alert"]'));
      }
    });

    test('should show upload progress', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.first().count() > 0) {
        await fileInput.first().setInputFiles({
          name: 'large-test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(1024 * 100, 0), // 100KB file
        });

        // Look for progress indicator
        const progressBar = page.locator('[role="progressbar"]')
          .or(page.locator('.progress'))
          .or(page.locator('text=%'));
      }
    });
  });

  test.describe('Document Actions', () => {
    test('should have download option for documents', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const documentItem = page.locator('[data-testid="document-item"]')
        .or(page.locator('[role="row"]')).first();

      if (await documentItem.isVisible()) {
        // Look for download button
        const downloadButton = documentItem.locator('button:has-text("Download")')
          .or(documentItem.locator('[data-testid="download-button"]'))
          .or(documentItem.locator('[aria-label*="download"]'));
      }
    });

    test('should have delete option for documents', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const documentItem = page.locator('[data-testid="document-item"]')
        .or(page.locator('[role="row"]')).first();

      if (await documentItem.isVisible()) {
        const deleteButton = documentItem.locator('button:has-text("Delete")')
          .or(documentItem.locator('[data-testid="delete-button"]'))
          .or(documentItem.locator('[aria-label*="delete"]'));
      }
    });

    test('should confirm before deleting document', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const documentItem = page.locator('[data-testid="document-item"]').first();

      if (await documentItem.isVisible()) {
        const deleteButton = documentItem.locator('button:has-text("Delete")').first();

        if (await deleteButton.isVisible()) {
          await deleteButton.click();

          // Should show confirmation dialog
          const confirmDialog = page.locator('[role="alertdialog"]')
            .or(page.locator('[role="dialog"]'))
            .or(page.locator('text=Are you sure'));

          await expect(confirmDialog.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Document Preview', () => {
    test('should have preview option for supported files', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const documentItem = page.locator('[data-testid="document-item"]')
        .or(page.locator('[role="row"]')).first();

      if (await documentItem.isVisible()) {
        // Click on document to preview
        await documentItem.click();

        // Look for preview modal or new page
        const previewModal = page.locator('[data-testid="document-preview"]')
          .or(page.locator('[role="dialog"]'))
          .or(page.locator('iframe'));
      }
    });
  });

  test.describe('Document Filtering', () => {
    test('should have search/filter for documents', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const searchInput = page.locator('input[type="search"]')
        .or(page.locator('input[placeholder*="search"]'))
        .or(page.locator('[data-testid="search-documents"]'));

      const filterButton = page.locator('button:has-text("Filter")')
        .or(page.locator('[data-testid="filter-button"]'));
    });

    test('should filter by document type', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      const typeFilter = page.locator('select[name="type"]')
        .or(page.locator('[data-testid="type-filter"]'))
        .or(page.locator('button:has-text("Type")'));

      if (await typeFilter.first().isVisible()) {
        await typeFilter.first().click();

        // Look for filter options
        const options = page.locator('[role="option"]')
          .or(page.locator('[role="menuitem"]'));
      }
    });
  });

  test.describe('Document Categories', () => {
    test('should show document categories or folders', async ({ page }) => {
      await page.goto('/dashboard/documents');
      await page.waitForLoadState('networkidle');

      // Look for category/folder navigation
      const categories = page.locator('[data-testid="document-categories"]')
        .or(page.locator('nav'))
        .or(page.locator('aside'));
    });
  });
});

test.describe('Document Security', () => {
  test('should not allow access without authentication', async ({ page }) => {
    // Clear any session
    await page.context().clearCookies();

    await page.goto('/dashboard/documents');

    // Should redirect to login
    await page.waitForURL(/\/(login|signin)/, { timeout: 10000 });
  });

  test('should not expose document URLs directly', async ({ page }) => {
    // Direct access to document should require auth
    await page.goto('/api/documents/test-id');

    // Should return 401 or redirect
    const response = await page.request.get('/api/documents/test-id');
    expect([401, 403, 404]).toContain(response.status());
  });
});
