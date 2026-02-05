/**
 * Cleanup Teardown for E2E Tests
 * Cleans up test data and resources after all tests complete.
 */

import { test as teardown } from '@playwright/test';
import { CleanupHelpers } from './fixtures/factories';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_STATE_DIR = path.join(__dirname, '.auth');

teardown.describe('Test Cleanup', () => {
  teardown('cleanup auth state files', async () => {
    // Clean up stored auth state files
    const authFiles = [
      'attorney.json',
      'client.json',
      'admin.json',
    ];

    for (const file of authFiles) {
      const filePath = path.join(STORAGE_STATE_DIR, file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up auth state: ${file}`);
        }
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Could not clean up ${file}:`, error);
      }
    }
  });

  teardown('cleanup test resources tracking', async () => {
    // Get created resources for logging
    const resources = CleanupHelpers.getCreatedResources();

    if (resources.caseIds.length > 0) {
      console.log(`Test cases created: ${resources.caseIds.length}`);
    }
    if (resources.documentIds.length > 0) {
      console.log(`Test documents created: ${resources.documentIds.length}`);
    }
    if (resources.formIds.length > 0) {
      console.log(`Test forms created: ${resources.formIds.length}`);
    }

    // Clear tracking
    CleanupHelpers.clearTracking();
    console.log('Resource tracking cleared');
  });

  teardown('log test completion', async () => {
    // Calculate test duration
    const startTime = process.env.TEST_START_TIME
      ? parseInt(process.env.TEST_START_TIME, 10)
      : Date.now();
    const duration = Date.now() - startTime;
    const durationMinutes = Math.floor(duration / 60000);
    const durationSeconds = Math.floor((duration % 60000) / 1000);

    console.log('\n========================================');
    console.log('E2E Test Suite Completed');
    console.log(`Duration: ${durationMinutes}m ${durationSeconds}s`);
    console.log('========================================\n');
  });
});
