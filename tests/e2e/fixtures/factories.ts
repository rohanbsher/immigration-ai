/**
 * Test data factories for E2E testing.
 * Provides isolated, parallel-safe test data creation.
 */

import { Page } from '@playwright/test';

// Test credentials - these should match seed data in test database
// NOTE: No hardcoded fallbacks for security - credentials MUST come from env vars
export const TEST_USERS = {
  attorney: {
    email: process.env.E2E_ATTORNEY_EMAIL || 'MISSING_E2E_ATTORNEY_EMAIL@invalid',
    password: process.env.E2E_ATTORNEY_PASSWORD || '',
    name: 'Test Attorney',
    role: 'attorney' as const,
  },
  client: {
    email: process.env.E2E_CLIENT_EMAIL || 'MISSING_E2E_CLIENT_EMAIL@invalid',
    password: process.env.E2E_CLIENT_PASSWORD || '',
    name: 'Test Client',
    role: 'client' as const,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'MISSING_E2E_ADMIN_EMAIL@invalid',
    password: process.env.E2E_ADMIN_PASSWORD || '',
    name: 'Test Admin',
    role: 'admin' as const,
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

/**
 * Timeout constants for E2E tests
 */
export const TIMEOUTS = {
  auth: 15000,
  navigation: 10000,
  element: 5000,
  toast: 5000,
} as const;

/**
 * Check if valid credentials are configured for a role
 */
export function hasValidCredentials(role: TestUserRole): boolean {
  const user = TEST_USERS[role];
  return (
    user.email.length > 0 &&
    !user.email.includes('MISSING_') &&
    user.password.length > 0
  );
}

// Track created resources for cleanup
interface CreatedResources {
  caseIds: string[];
  documentIds: string[];
  formIds: string[];
}

/**
 * WARNING: Module-level mutable state - NOT safe for parallel test workers.
 * Each Playwright worker gets its own module instance, so this only tracks
 * resources within a single worker. For true parallel safety, use Playwright
 * fixtures instead. See: https://playwright.dev/docs/test-fixtures
 *
 * TODO: Migrate to Playwright fixtures pattern for proper test isolation.
 */
const createdResources: CreatedResources = {
  caseIds: [],
  documentIds: [],
  formIds: [],
};

/**
 * Generate a unique test ID for parallel test isolation
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(): string {
  return `test-${generateTestId()}@example.com`;
}

/**
 * Generate a unique test case title
 */
export function generateCaseTitle(): string {
  return `Test Case ${generateTestId()}`;
}

/**
 * Factory for creating test cases via API or UI
 */
export const CaseFactory = {
  /**
   * Create a case via UI
   */
  async createViaUI(
    page: Page,
    options: {
      title?: string;
      type?: string;
      clientEmail?: string;
    } = {}
  ): Promise<string | null> {
    const title = options.title || generateCaseTitle();

    await page.goto('/dashboard/cases/new');
    await page.waitForLoadState('domcontentloaded');

    // Fill title
    const titleInput = page.locator('input[name="title"]').or(page.locator('input[placeholder*="title"]'));
    if (await titleInput.first().isVisible()) {
      await titleInput.first().fill(title);
    }

    // Select type if provided
    if (options.type) {
      const typeSelector = page.locator('select[name="type"]').or(page.locator('[data-testid="case-type"]'));
      if (await typeSelector.first().isVisible()) {
        await typeSelector.first().selectOption({ label: options.type });
      }
    }

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard\/cases/, { timeout: TIMEOUTS.navigation });

    // Extract case ID from URL if possible
    const url = page.url();
    const match = url.match(/\/cases\/([a-f0-9-]+)/);
    const caseId = match?.[1] || null;

    if (caseId) {
      createdResources.caseIds.push(caseId);
    }

    return caseId;
  },

  /**
   * Get default case data for tests
   */
  getDefaults(overrides: Partial<{
    title: string;
    type: string;
    status: string;
  }> = {}) {
    return {
      title: generateCaseTitle(),
      type: 'H-1B',
      status: 'intake',
      ...overrides,
    };
  },
};

/**
 * Factory for creating test documents
 */
export const DocumentFactory = {
  /**
   * Create a mock PDF file for upload
   */
  createMockPDF(name?: string): {
    name: string;
    mimeType: string;
    buffer: Buffer;
  } {
    // PDF magic bytes + minimal valid PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
trailer
<< /Size 3 /Root 1 0 R >>
startxref
109
%%EOF`;

    return {
      name: name || `test-document-${generateTestId()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfContent),
    };
  },

  /**
   * Create a mock image file
   */
  createMockImage(type: 'png' | 'jpeg' = 'png'): {
    name: string;
    mimeType: string;
    buffer: Buffer;
  } {
    if (type === 'png') {
      // Minimal valid PNG (1x1 transparent pixel)
      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
        0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
        0x42, 0x60, 0x82,
      ]);
      return {
        name: `test-image-${generateTestId()}.png`,
        mimeType: 'image/png',
        buffer: pngBytes,
      };
    }

    // Minimal valid JPEG (1x1 pixel)
    const jpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
      0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
      0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
      0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
      0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
      0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
      0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
      0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
      0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
      0x3f, 0x00, 0xfb, 0xd3, 0x28, 0xa0, 0x02, 0x80,
      0x0a, 0x00, 0x28, 0x00, 0xa0, 0x02, 0x80, 0x0a,
      0x00, 0x28, 0x03, 0xff, 0xd9,
    ]);
    return {
      name: `test-image-${generateTestId()}.jpg`,
      mimeType: 'image/jpeg',
      buffer: jpegBytes,
    };
  },

  /**
   * Create a malicious file for security testing
   */
  createMaliciousFile(type: 'spoofed-extension' | 'script-injection'): {
    name: string;
    mimeType: string;
    buffer: Buffer;
  } {
    if (type === 'spoofed-extension') {
      // EXE file content with .pdf extension
      return {
        name: `malicious-${generateTestId()}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from([0x4d, 0x5a]), // MZ header (EXE)
      };
    }

    // Script injection attempt
    return {
      name: `malicious-${generateTestId()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('<script>alert("xss")</script>'),
    };
  },
};

/**
 * Factory for creating test forms
 */
export const FormFactory = {
  /**
   * Get sample form data for different form types
   */
  getSampleData(formType: 'I-130' | 'I-485' | 'I-765' | 'I-131' | 'N-400') {
    const baseData = {
      petitioner: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-01-15',
        countryOfBirth: 'United States',
        ssn: '123-45-6789',
      },
      beneficiary: {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1985-06-20',
        countryOfBirth: 'Canada',
        alienNumber: 'A123456789',
      },
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'United States',
      },
    };

    const formSpecificData: Record<string, Record<string, unknown>> = {
      'I-130': {
        ...baseData,
        relationship: 'spouse',
        marriageDate: '2020-05-15',
        marriagePlace: 'New York, NY',
      },
      'I-485': {
        ...baseData,
        classOfAdmission: 'Family-based',
        dateOfLastEntry: '2019-01-10',
        i94Number: '123456789AB',
      },
      'I-765': {
        ...baseData,
        eligibilityCategory: '(c)(9)',
        previousEADNumber: '',
      },
      'I-131': {
        ...baseData,
        travelPurpose: 'Humanitarian',
        countriesVisited: ['Canada', 'Mexico'],
        intendedDeparture: '2024-06-01',
        intendedReturn: '2024-07-01',
      },
      'N-400': {
        ...baseData,
        residenceSince: '2015-01-01',
        employmentHistory: [],
        travelHistory: [],
      },
    };

    return formSpecificData[formType] || baseData;
  },

  /**
   * Get AI-filled data with confidence scores for testing review workflow
   */
  getAIFilledData(confidence: 'high' | 'mixed' | 'low' = 'mixed') {
    const confidenceMap = {
      high: { min: 0.85, max: 0.99 },
      mixed: { min: 0.50, max: 0.95 },
      low: { min: 0.30, max: 0.70 },
    };

    const { min, max } = confidenceMap[confidence];

    const fields = [
      'firstName', 'lastName', 'dateOfBirth', 'ssn',
      'alienNumber', 'passportNumber', 'address.street',
      'address.city', 'address.state', 'address.zipCode',
    ];

    const aiData: Record<string, unknown> = {};
    const confidenceScores: Record<string, number> = {};

    for (const field of fields) {
      aiData[field] = `AI-extracted-${field}`;
      confidenceScores[field] = min + Math.random() * (max - min);
    }

    return { aiData, confidenceScores };
  },
};

/**
 * Authentication helpers
 */
export const AuthHelpers = {
  /**
   * Login as a specific user role
   */
  async loginAs(page: Page, role: TestUserRole): Promise<void> {
    const user = TEST_USERS[role];
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // If redirected away from login (already authenticated via storageState),
    // clear all auth state (cookies + localStorage) and retry
    if (!page.url().includes('/login')) {
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        // Re-set cookie consent to prevent consent banner from appearing
        localStorage.setItem('immigration-ai-consent', JSON.stringify({
          analytics: false, timestamp: new Date().toISOString(), version: '1.0',
        }));
      });
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
    }

    const emailInput = page.locator('input[placeholder*="example.com"]').or(page.locator('input[type="email"]'));
    const passwordInput = page.locator('input[placeholder*="password"]').or(page.locator('input[type="password"]'));

    await emailInput.first().fill(user.email);
    await passwordInput.first().fill(user.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.auth });
  },

  /**
   * Logout current user
   */
  async logout(page: Page): Promise<void> {
    const userMenu = page.locator('[data-testid="user-menu"]').or(page.locator('button:has-text("Logout")'));
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }

    const logoutButton = page.locator('button:has-text("Logout")').or(page.locator('[data-testid="logout-button"]'));
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }

    await page.waitForURL(/\/(login|$)/, { timeout: TIMEOUTS.navigation });
  },

  /**
   * Check if user is logged in
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    return page.url().includes('/dashboard');
  },
};

/**
 * Navigation helpers
 */
export const NavHelpers = {
  async goToCases(page: Page): Promise<void> {
    await page.goto('/dashboard/cases');
    await page.waitForLoadState('domcontentloaded');
  },

  async goToDocuments(page: Page): Promise<void> {
    await page.goto('/dashboard/documents');
    await page.waitForLoadState('domcontentloaded');
  },

  async goToForms(page: Page): Promise<void> {
    await page.goto('/dashboard/forms');
    await page.waitForLoadState('domcontentloaded');
  },

  async goToBilling(page: Page): Promise<void> {
    await page.goto('/dashboard/billing');
    await page.waitForLoadState('domcontentloaded');
  },

  async goToSettings(page: Page): Promise<void> {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('domcontentloaded');
  },
};

/**
 * Cleanup helpers for test isolation
 */
export const CleanupHelpers = {
  /**
   * Get all created resources for cleanup
   */
  getCreatedResources(): CreatedResources {
    return { ...createdResources };
  },

  /**
   * Clear tracking of created resources
   */
  clearTracking(): void {
    createdResources.caseIds = [];
    createdResources.documentIds = [];
    createdResources.formIds = [];
  },
};

/**
 * Wait helpers for async operations
 */
export const WaitHelpers = {
  /**
   * Wait for a toast notification
   */
  async forToast(page: Page, message: string, timeout: number = TIMEOUTS.toast): Promise<void> {
    await page.locator(`text="${message}"`).or(page.locator(`[role="alert"]:has-text("${message}")`))
      .waitFor({ state: 'visible', timeout });
  },

  /**
   * Wait for an API response
   */
  async forApiResponse(page: Page, urlPattern: string | RegExp): Promise<void> {
    await page.waitForResponse((response) => {
      if (typeof urlPattern === 'string') {
        return response.url().includes(urlPattern);
      }
      return urlPattern.test(response.url());
    });
  },

  /**
   * Wait for network to be idle
   */
  async forNetworkIdle(page: Page, timeout: number = TIMEOUTS.element): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  },
};
