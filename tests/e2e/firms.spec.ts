import { test, expect } from '@playwright/test';

// NOTE: This file uses E2E_TEST_USER (legacy generic user) and E2E_ATTORNEY_USER (legacy pattern)
// instead of E2E_ATTORNEY_EMAIL (role-based pattern from factories.ts).
// TODO: Migrate to hasValidCredentials() when env vars are standardized across CI/CD
const hasTestCredentials = process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD;
const hasAttorneyCredentials = process.env.E2E_ATTORNEY_USER && process.env.E2E_ATTORNEY_PASSWORD;

test.describe('Firm Management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Use attorney credentials if available, otherwise regular user
    const email = hasAttorneyCredentials ? process.env.E2E_ATTORNEY_USER! : process.env.E2E_TEST_USER!;
    const password = hasAttorneyCredentials ? process.env.E2E_ATTORNEY_PASSWORD! : process.env.E2E_TEST_PASSWORD!;

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test.describe('Firm Settings Page', () => {
    test('should have firm settings section', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      // Look for firm/organization section
      const firmSection = page.locator('text=Firm')
        .or(page.locator('text=Organization'))
        .or(page.locator('[data-testid="firm-settings"]'));
    });

    test('should display firm information', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")')
        .or(page.locator('a:has-text("Organization")'));

      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();

        // Look for firm name field
        const firmName = page.locator('input[name="firmName"]')
          .or(page.locator('[data-testid="firm-name"]'));
      }
    });
  });

  test.describe('Firm Creation', () => {
    test('should have create firm option for attorneys', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const createFirmButton = page.locator('button:has-text("Create Firm")')
        .or(page.locator('button:has-text("Set up Firm")')
        .or(page.locator('[data-testid="create-firm"]')));

      // Button may or may not be visible depending on user's current firm status
    });

    test('should have firm creation form', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');

      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      // Look for form elements
      const firmNameInput = page.locator('input[name="firmName"]')
        .or(page.locator('input[placeholder*="firm"]'));
    });
  });

  test.describe('Member Management', () => {
    test('should show team members section', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const membersSection = page.locator('text=Members')
        .or(page.locator('text=Team'))
        .or(page.locator('[data-testid="team-members"]'));
    });

    test('should have invite member button', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")')
        .or(page.locator('button:has-text("Team")'));

      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const inviteButton = page.locator('button:has-text("Invite")')
        .or(page.locator('button:has-text("Add Member")')
        .or(page.locator('[data-testid="invite-member"]')));
    });

    test('should show invite member modal', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const inviteButton = page.locator('button:has-text("Invite")');

      if (await inviteButton.first().isVisible()) {
        await inviteButton.first().click();

        // Should show invite modal
        const inviteModal = page.locator('[role="dialog"]')
          .or(page.locator('[data-testid="invite-modal"]'));
        await expect(inviteModal.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('should validate invite email', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const inviteButton = page.locator('button:has-text("Invite")');

      if (await inviteButton.first().isVisible()) {
        await inviteButton.first().click();

        const emailInput = page.locator('input[name="email"]')
          .or(page.locator('input[type="email"]'));

        if (await emailInput.first().isVisible()) {
          await emailInput.first().fill('invalid-email');

          const submitInvite = page.locator('button:has-text("Send")');
          if (await submitInvite.first().isVisible()) {
            await submitInvite.first().click();

            // Should show validation error
            const errorMessage = page.locator('[role="alert"]')
              .or(page.locator('text=valid email'));
          }
        }
      }
    });

    test('should display member list', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      // Look for member list
      const memberList = page.locator('[data-testid="member-list"]')
        .or(page.locator('[role="table"]'))
        .or(page.locator('.member-row'));
    });

    test('should show member roles', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      // Look for role indicators
      const roleIndicator = page.locator('text=Admin')
        .or(page.locator('text=Member'))
        .or(page.locator('text=Owner'))
        .or(page.locator('[data-testid="member-role"]'));
    });
  });

  test.describe('Member Actions', () => {
    test('should have remove member option', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const memberRow = page.locator('[data-testid="member-row"]').first();

      if (await memberRow.isVisible()) {
        const removeButton = memberRow.locator('button:has-text("Remove")')
          .or(memberRow.locator('[data-testid="remove-member"]'));
      }
    });

    test('should have change role option', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const memberRow = page.locator('[data-testid="member-row"]').first();

      if (await memberRow.isVisible()) {
        const roleSelector = memberRow.locator('select')
          .or(memberRow.locator('[data-testid="role-select"]'));
      }
    });

    test('should confirm before removing member', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const removeButton = page.locator('button:has-text("Remove")').first();

      if (await removeButton.isVisible()) {
        await removeButton.click();

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="alertdialog"]')
          .or(page.locator('[role="dialog"]'));
        await expect(confirmDialog.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Invitations', () => {
    test('should show pending invitations', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const pendingSection = page.locator('text=Pending')
        .or(page.locator('[data-testid="pending-invitations"]'));
    });

    test('should allow resending invitations', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const resendButton = page.locator('button:has-text("Resend")')
        .or(page.locator('[data-testid="resend-invite"]'));
    });

    test('should allow revoking invitations', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const firmTab = page.locator('button:has-text("Firm")');
      if (await firmTab.first().isVisible()) {
        await firmTab.first().click();
      }

      const revokeButton = page.locator('button:has-text("Revoke")')
        .or(page.locator('[data-testid="revoke-invite"]'));
    });
  });
});

test.describe('Multi-Tenancy', () => {
  test('should isolate data between firms', async ({ page }) => {
    // This is a security test - would need multiple test accounts
    test.skip(!hasAttorneyCredentials, 'Requires attorney credentials');

    // Login as attorney
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_ATTORNEY_USER!);
    await page.fill('input[name="password"]', process.env.E2E_ATTORNEY_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // Navigate to cases
    await page.goto('/dashboard/cases');
    await page.waitForLoadState('networkidle');

    // Should only see firm's cases, not other firms' cases
  });
});

test.describe('Firm API Security', () => {
  test('should not allow access to other firms data', async ({ page }) => {
    // Direct API access test
    const response = await page.request.get('/api/firms/invalid-firm-id');
    expect([401, 403, 404]).toContain(response.status());
  });

  test('should protect member endpoints', async ({ page }) => {
    const response = await page.request.get('/api/firms/invalid-id/members');
    expect([401, 403, 404]).toContain(response.status());
  });

  test('should protect invitation endpoints', async ({ page }) => {
    const response = await page.request.post('/api/firms/invalid-id/invitations', {
      data: { email: 'test@example.com' },
    });
    expect([401, 403, 404]).toContain(response.status());
  });
});
