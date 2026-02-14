import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 6 : undefined,
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

    // Main browser tests (Desktop Chrome)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Reuse auth state from setup (tests can override with test.use())
        storageState: 'tests/e2e/.auth/attorney.json',
      },
      dependencies: ['auth-setup'],
    },

    // Security tests (separate project for isolation)
    {
      name: 'security',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /security\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
      // Security tests get extra time
      timeout: 60000,
    },
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },

  // Global timeout settings
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  // Output directory for test results
  outputDir: 'test-results/',

  // Preserve output on failure
  preserveOutput: 'failures-only',

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
});
