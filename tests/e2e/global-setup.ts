/**
 * Global setup for Playwright E2E tests.
 * Runs once before all test projects.
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  // Create auth directory if it doesn't exist (consistent with auth.setup.ts)
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Log test configuration
  console.log('\n🚀 Starting E2E test suite');
  console.log(`   Base URL: ${config.projects[0]?.use?.baseURL || 'http://localhost:3000'}`);
  console.log(`   Workers: ${config.workers || 'auto'}`);
  console.log(`   Projects: ${config.projects.map(p => p.name).join(', ')}`);

  // Check for required environment variables
  const requiredEnvVars = [
    'E2E_ATTORNEY_EMAIL',
    'E2E_ATTORNEY_PASSWORD',
    'E2E_CLIENT_EMAIL',
    'E2E_CLIENT_PASSWORD',
  ];

  // Optional environment variables (tests will skip if not set)
  const optionalEnvVars = [
    'E2E_ADMIN_EMAIL',
    'E2E_ADMIN_PASSWORD',
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  const missingOptional = optionalEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    // In CI, require credentials by default (can be overridden with E2E_REQUIRE_CREDENTIALS=false)
    if (process.env.CI && process.env.E2E_REQUIRE_CREDENTIALS !== 'false') {
      throw new Error(
        `CI requires E2E credentials. Missing: ${missingVars.join(', ')}.\n` +
        `Set these in your CI secrets or .env.local file.\n` +
        `To skip credential checks, set E2E_REQUIRE_CREDENTIALS=false`
      );
    }
    console.warn('\n⚠️  Missing test credentials - some tests will be skipped:');
    missingVars.forEach(v => console.warn(`   - ${v}`));
    console.warn('   Set these in your .env.local file for full test coverage.\n');
  }

  // Log missing optional credentials (info only, not a warning)
  // Only show this if required vars are all present to avoid noise when setup is incomplete
  if (missingVars.length === 0 && missingOptional.length > 0) {
    console.log(`   Optional credentials not set: ${missingOptional.join(', ')}`);
  }

  // Verify the test server is reachable
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  try {
    const response = await fetch(`${baseURL}/api/health`, { method: 'GET' });
    if (!response.ok) {
      console.warn(`\n⚠️  Health check returned status ${response.status}. Tests may fail.\n`);
    } else {
      console.log(`   Health check: OK`);
    }
  } catch {
    if (process.env.CI) {
      console.warn('\n⚠️  Cannot reach E2E target. Tests will likely fail.\n');
    } else {
      console.log('\n📦 Waiting for dev server to start...\n');
    }
  }

  // Store start time for duration calculation
  process.env.TEST_START_TIME = Date.now().toString();
}

export default globalSetup;
