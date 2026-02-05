# Plan: Fix Multi-Agent Testing Issues

## Overview
Address 12 issues identified in staff engineer code review before PR merge.

---

## Phase 1: BLOCKING Issues (Must Fix First)

### Issue 1: Auth Setup Silently Swallows Failures
**Files:** `tests/e2e/auth.setup.ts`

**Current Problem:**
```typescript
} catch (error) {
  console.warn('Attorney login failed - tests requiring auth will be skipped');
}
```

**Fix Strategy:**
1. Create auth state marker files to indicate success/failure
2. Have dependent tests check for marker before running
3. Use Playwright's `test.skip()` with condition based on auth state

**Implementation:**
```typescript
// In auth.setup.ts - after successful login
await fs.writeFile(path.join(STORAGE_STATE_DIR, '.attorney-ready'), '');

// On failure
await fs.writeFile(path.join(STORAGE_STATE_DIR, '.attorney-failed'), error.message);

// In test files
import { existsSync } from 'fs';
const hasAttorneyAuth = existsSync(ATTORNEY_AUTH_FILE) &&
                        existsSync(path.join(STORAGE_STATE_DIR, '.attorney-ready'));
test.skip(!hasAttorneyAuth, 'Attorney auth not available');
```

---

### Issue 2: Auth State Files Not Being Used
**Files:** `tests/e2e/auth.setup.ts`, all E2E spec files

**Current Problem:** Tests export auth files but specs login manually each time.

**Fix Strategy:**
1. Create a helper function `useAuthState(role)` in factories
2. Update tests to use `test.use({ storageState: ATTORNEY_AUTH_FILE })`
3. Remove manual login code from individual tests

**Implementation:**
```typescript
// In factories.ts
export const AuthHelpers = {
  useAttorneyAuth: () => ({ storageState: ATTORNEY_AUTH_FILE }),
  useClientAuth: () => ({ storageState: CLIENT_AUTH_FILE }),
  useAdminAuth: () => ({ storageState: ADMIN_AUTH_FILE }),
};

// In spec files
test.describe('Attorney Cases', () => {
  test.use(AuthHelpers.useAttorneyAuth());

  test('should list cases', async ({ page }) => {
    // No login needed - already authenticated
    await page.goto('/dashboard/cases');
  });
});
```

---

### Issue 3: No `.auth` Directory in .gitignore
**File:** `.gitignore`

**Fix:** Add single line
```
tests/e2e/.auth/
```

---

## Phase 2: HIGH PRIORITY Issues

### Issue 4: Hardcoded Fallback Credentials
**File:** `tests/e2e/fixtures/factories.ts`

**Fix Strategy:**
1. Remove password fallbacks entirely
2. Use clearly invalid fallbacks for emails
3. Add validation function to check env vars

**Implementation:**
```typescript
export const TEST_USERS = {
  attorney: {
    email: process.env.E2E_ATTORNEY_EMAIL || 'MISSING_E2E_ATTORNEY_EMAIL@invalid',
    password: process.env.E2E_ATTORNEY_PASSWORD || '',
    // ...
  },
};

export function hasValidCredentials(role: TestUserRole): boolean {
  const user = TEST_USERS[role];
  return user.email.length > 0 &&
         !user.email.includes('MISSING_') &&
         user.password.length > 0;
}
```

---

### Issue 5: Unused `page` Parameter Warnings (11 instances)
**Files:** Security test specs

**Fix Strategy:**
1. For tests that genuinely don't need `page`, use `_page` or omit
2. For tests that should use `page`, implement properly
3. Some security tests should be API tests - refactor those

**Implementation:**
```typescript
// Option A: Omit unused parameter
test('rate limit headers present', async ({ request }) => {
  // API-level test, no page needed
});

// Option B: Prefix with underscore
test('some test', async ({ page: _page }) => {
  // Acknowledged unused
});
```

---

### Issue 6: Global State Mutation in Factories
**File:** `tests/e2e/fixtures/factories.ts`

**Fix Strategy:**
1. Remove module-level `createdResources` object
2. Use Playwright fixtures for per-test resource tracking
3. Pass cleanup arrays to individual tests

**Implementation:**
```typescript
// Remove this:
const createdResources = { ... };

// Add this as a fixture:
import { test as base } from '@playwright/test';

type ResourceTracker = {
  caseIds: string[];
  documentIds: string[];
  cleanup: () => Promise<void>;
};

export const test = base.extend<{ resources: ResourceTracker }>({
  resources: async ({}, use) => {
    const tracker: ResourceTracker = {
      caseIds: [],
      documentIds: [],
      cleanup: async () => { /* cleanup logic */ },
    };
    await use(tracker);
    await tracker.cleanup();
  },
});
```

---

## Phase 3: MEDIUM PRIORITY Issues

### Issue 7: Overly Broad Locators
**Files:** Multiple E2E specs

**Fix Strategy:**
1. Add `data-testid` attributes to key UI elements
2. Create a locator helper with fallback chain
3. Document preferred selector strategy

**Implementation:**
```typescript
// In factories.ts
export const Locators = {
  loginEmail: (page: Page) =>
    page.getByTestId('login-email')
      .or(page.locator('input[name="email"]')),
  loginPassword: (page: Page) =>
    page.getByTestId('login-password')
      .or(page.locator('input[name="password"]')),
};
```

---

### Issue 8: Hardcoded Timeouts
**Files:** Throughout E2E tests

**Fix Strategy:**
1. Create timeout constants in factories
2. Use descriptive names
3. Allow CI override via env vars

**Implementation:**
```typescript
// In factories.ts
export const TIMEOUTS = {
  navigation: Number(process.env.E2E_TIMEOUT_NAVIGATION) || 15000,
  elementVisible: Number(process.env.E2E_TIMEOUT_ELEMENT) || 10000,
  apiResponse: Number(process.env.E2E_TIMEOUT_API) || 30000,
  shortWait: 2000,
};
```

---

### Issue 9: No Test Data Cleanup Strategy
**Files:** E2E infrastructure

**Fix Strategy:**
1. Tag test-created data with unique prefix
2. Add cleanup in `cleanup.teardown.ts`
3. Use database cleanup script for CI

**Implementation:**
```typescript
// In cleanup.teardown.ts
setup('cleanup test data', async ({ request }) => {
  // Call cleanup API endpoint
  await request.delete('/api/test/cleanup', {
    data: { prefix: 'test-' }
  });
});
```

---

## Phase 4: MINOR Issues

### Issue 10: Inconsistent Test Descriptions
**Fix:** Use "should" prefix consistently

### Issue 11: Missing Test Documentation
**Fix:** Add JSDoc to all E2E test describes

### Issue 12: `require.resolve` in Config
**Fix:** Use ESM import with `import.meta.url`

---

## Implementation Order

1. **Immediate (30 min):**
   - Add `.auth/` to `.gitignore`
   - Fix hardcoded password fallbacks
   - Fix unused `page` warnings (use `_page` prefix)

2. **Short-term (1 hour):**
   - Fix auth setup error handling
   - Implement auth state usage in tests
   - Add timeout constants

3. **Medium-term (2 hours):**
   - Refactor resource tracking to fixtures
   - Add locator helpers
   - Add test data cleanup

4. **Nice-to-have:**
   - Consistent test descriptions
   - Documentation
   - ESM config

---

## Verification Checklist

- [ ] `.gitignore` includes `.auth/`
- [ ] No hardcoded passwords in factories
- [ ] Auth setup fails explicitly or marks state
- [ ] At least one test uses `storageState`
- [ ] No lint errors (0 errors, warnings acceptable)
- [ ] TypeScript passes (`npx tsc --noEmit`)
- [ ] All unit tests pass (`npm run test:run`)
- [ ] E2E tests list without errors (`npx playwright test --list`)
