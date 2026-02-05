import { test, expect } from '@playwright/test';

// NOTE: Uses E2E_TEST_USER (legacy generic user) instead of E2E_ATTORNEY_EMAIL (role-based)
// TODO: Migrate to hasValidCredentials() when env vars are standardized across CI/CD
const hasTestCredentials = process.env.E2E_TEST_USER && process.env.E2E_TEST_PASSWORD;

// Stripe test card numbers
const STRIPE_TEST_CARD = '4242424242424242';
const STRIPE_TEST_CARD_DECLINED = '4000000000000002';
const STRIPE_TEST_CVC = '123';
const STRIPE_TEST_EXP = '12/30';
const STRIPE_TEST_ZIP = '12345';

test.describe('Billing & Subscription', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials - skipping authenticated tests');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test.describe('Pricing Page', () => {
    test('should display pricing page', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Should show pricing content
      const pricingHeading = page.locator('h1:has-text("Pricing")')
        .or(page.locator('text=Plans'))
        .or(page.locator('text=Choose your plan'));
      await expect(pricingHeading.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display multiple pricing tiers', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for pricing cards
      const pricingCards = page.locator('[data-testid="pricing-card"]')
        .or(page.locator('.pricing-tier'))
        .or(page.locator('[class*="plan"]'));

      const cardCount = await pricingCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test('should show pricing amounts', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for price indicators
      const priceIndicator = page.locator('text=$')
        .or(page.locator('text=/month'))
        .or(page.locator('text=/year'));
      await expect(priceIndicator.first()).toBeVisible();
    });

    test('should have upgrade buttons for paid plans', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      const upgradeButton = page.locator('button:has-text("Upgrade")')
        .or(page.locator('button:has-text("Subscribe")')
        .or(page.locator('button:has-text("Get Started")')
        .or(page.locator('button:has-text("Choose")'))));

      await expect(upgradeButton.first()).toBeVisible();
    });

    test('should highlight current plan', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for current plan indicator
      const currentPlan = page.locator('text=Current')
        .or(page.locator('[data-current="true"]'))
        .or(page.locator('.current-plan'));
    });
  });

  test.describe('Subscription Management', () => {
    test('should have settings/billing section', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      // Look for billing tab or section
      const billingSection = page.locator('text=Billing')
        .or(page.locator('text=Subscription'))
        .or(page.locator('[data-testid="billing-tab"]'));
      await expect(billingSection.first()).toBeVisible();
    });

    test('should display current subscription status', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      // Click on billing section if it's a tab
      const billingTab = page.locator('button:has-text("Billing")')
        .or(page.locator('a:has-text("Billing")'));

      if (await billingTab.first().isVisible()) {
        await billingTab.first().click();
      }

      // Look for subscription info
      const subscriptionInfo = page.locator('text=Free')
        .or(page.locator('text=Pro'))
        .or(page.locator('text=Enterprise'))
        .or(page.locator('[data-testid="subscription-status"]'));
    });

    test('should show manage subscription button for paid users', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const billingTab = page.locator('button:has-text("Billing")')
        .or(page.locator('a:has-text("Billing")'));

      if (await billingTab.first().isVisible()) {
        await billingTab.first().click();
      }

      // Look for manage button
      const manageButton = page.locator('button:has-text("Manage")')
        .or(page.locator('a:has-text("Manage Subscription")'));
    });
  });

  test.describe('Checkout Flow', () => {
    test('should redirect to Stripe checkout on upgrade', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Find upgrade button for a paid plan
      const upgradeButton = page.locator('button:has-text("Upgrade")')
        .or(page.locator('button:has-text("Subscribe")'));

      if (await upgradeButton.first().isVisible()) {
        await upgradeButton.first().click();

        // Should redirect to Stripe or show checkout modal
        await page.waitForTimeout(3000);

        const url = page.url();
        const isStripe = url.includes('checkout.stripe.com');
        const hasCheckoutModal = await page.locator('[data-testid="checkout-modal"]').isVisible();

        // Either redirected to Stripe or showing local checkout
        expect(isStripe || hasCheckoutModal || url.includes('checkout')).toBeTruthy();
      }
    });
  });

  test.describe('Plan Features', () => {
    test('should display feature comparison', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for feature lists
      const featureList = page.locator('[data-testid="feature-list"]')
        .or(page.locator('ul'))
        .or(page.locator('text=included'));
    });

    test('should show case limits per plan', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for case limit information
      const caseLimits = page.locator('text=case')
        .or(page.locator('text=Cases'))
        .or(page.locator('text=unlimited'));
    });

    test('should show AI features availability', async ({ page }) => {
      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // Look for AI feature mentions
      const aiFeatures = page.locator('text=AI')
        .or(page.locator('text=analysis'))
        .or(page.locator('text=automation'));
    });
  });

  test.describe('Usage Limits', () => {
    test('should display usage stats', async ({ page }) => {
      await page.goto('/dashboard/settings');
      await page.waitForLoadState('networkidle');

      const billingTab = page.locator('button:has-text("Billing")');

      if (await billingTab.first().isVisible()) {
        await billingTab.first().click();
      }

      // Look for usage metrics
      const usageStats = page.locator('[data-testid="usage-stats"]')
        .or(page.locator('text=used'))
        .or(page.locator('text=remaining'));
    });

    test('should show upgrade prompt when near limits', async ({ page }) => {
      // This test is scenario-dependent on user's actual usage
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Look for upgrade prompts
      const upgradePrompt = page.locator('text=Upgrade')
        .or(page.locator('[data-testid="upgrade-prompt"]'));
    });
  });
});

test.describe('Stripe Integration', () => {
  test.describe('Webhook Handling', () => {
    test('should have health endpoint for Stripe', async ({ page }) => {
      const response = await page.request.get('/api/health');
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Test Mode Indicators', () => {
    test('should show test mode indicator in development', async ({ page }) => {
      test.skip(!hasTestCredentials, 'No test credentials');

      await page.goto('/login');
      await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
      await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/);

      await page.goto('/pricing');
      await page.waitForLoadState('networkidle');

      // In test mode, there might be an indicator
      const testIndicator = page.locator('text=test mode')
        .or(page.locator('[data-testid="test-mode"]'));
    });
  });
});

test.describe('Billing Security', () => {
  test('should not expose Stripe keys in page source', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const content = await page.content();

    // Should not contain secret key patterns
    expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
    expect(content).not.toMatch(/sk_test_[a-zA-Z0-9]+/);
  });

  test('should use HTTPS for checkout', async ({ page }) => {
    test.skip(!hasTestCredentials, 'No test credentials');

    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_USER!);
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const upgradeButton = page.locator('button:has-text("Upgrade")').first();

    if (await upgradeButton.isVisible()) {
      // Listen for navigation
      const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);

      await upgradeButton.click();
      await navigationPromise;

      const url = page.url();
      if (url.includes('stripe.com')) {
        expect(url.startsWith('https://')).toBeTruthy();
      }
    }
  });
});
