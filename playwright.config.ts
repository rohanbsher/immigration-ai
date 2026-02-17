import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Auth setup project - runs first to create auth state
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      teardown: 'cleanup',
    },

    // Cleanup project - runs after all tests
    {
      name: 'cleanup',
      testMatch: /cleanup\.teardown\.ts/,
    },

    // Main browser tests — attorney-authenticated (Desktop Chrome)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/attorney.json',
      },
      testIgnore: /\/(security|auth|client)\//,
      dependencies: ['auth-setup'],
    },

    // Client-role tests — client-authenticated
    {
      name: 'client',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/client.json',
      },
      testMatch: /client\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
    },

    // Auth tests — need unauthenticated context to test login/register forms
    // NOTE: Must include cookie consent in localStorage to prevent banner from blocking form elements
    {
      name: 'auth-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [{
            origin: process.env.E2E_BASE_URL || 'http://localhost:3000',
            localStorage: [{
              name: 'immigration-ai-consent',
              value: JSON.stringify({ analytics: false, timestamp: '2026-01-01T00:00:00Z', version: '1.0' }),
            }],
          }],
        },
      },
      testMatch: /auth\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
    },

    // Security login tests — test the login page directly (unauthenticated)
    // NOTE: Must include cookie consent in localStorage to prevent banner from blocking form elements
    {
      name: 'security-login',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [{
            origin: process.env.E2E_BASE_URL || 'http://localhost:3000',
            localStorage: [{
              name: 'immigration-ai-consent',
              value: JSON.stringify({ analytics: false, timestamp: '2026-01-01T00:00:00Z', version: '1.0' }),
            }],
          }],
        },
      },
      testMatch: /security\/auth-attacks\.spec\.ts/,
      dependencies: ['auth-setup'],
      timeout: 120000,
    },

    // Security access tests — attorney pre-authenticated for authorization + tenant isolation
    {
      name: 'security-access',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/attorney.json',
      },
      testMatch: /security\/(authorization|tenant-isolation)\.spec\.ts/,
      dependencies: ['auth-setup'],
      timeout: 60000,
    },

    // Visual regression — attorney-authenticated pages
    {
      name: 'visual-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/attorney.json',
      },
      testMatch: /visual\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
    },

    // Visual regression — unauthenticated pages (login)
    {
      name: 'visual-unauth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: {
          cookies: [],
          origins: [{
            origin: process.env.E2E_BASE_URL || 'http://localhost:3000',
            localStorage: [{
              name: 'immigration-ai-consent',
              value: JSON.stringify({ analytics: false, timestamp: '2026-01-01T00:00:00Z', version: '1.0' }),
            }],
          }],
        },
      },
      testMatch: /visual\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },

  // Global timeout settings — CI uses production URL which has cold starts
  timeout: process.env.CI ? 45000 : 30000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      // Allow small anti-aliasing differences across platforms
      maxDiffPixelRatio: 0.05,
      // Store snapshots in a predictable location per project
      pathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    },
  },

  // Output directory for test results
  outputDir: 'test-results/',

  // Preserve output on failure
  preserveOutput: 'failures-only',

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
});
