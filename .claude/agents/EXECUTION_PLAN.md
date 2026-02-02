# Immigration AI - Detailed Execution Plan

> Generated: 2026-01-30 17:30
> This file contains line-by-line implementation details for each task in TODO.md

---

## Phase 1: Fix Test Failures (20 tests)

### Task 1.1: Fix AI Error Message

**File:** `src/lib/ai/utils.ts`
**Line:** 68

**Current code:**
```typescript
if (!jsonMatch) {
  throw new Error('No JSON found in response');
}
```

**Change to:**
```typescript
if (!jsonMatch) {
  throw new Error('Could not parse JSON response from Claude');
}
```

**Why:** Test at `src/lib/ai/index.test.ts:1062-1074` expects this exact message.

---

### Task 1.2: Fix Auth Tests

**File:** `src/lib/auth/index.test.ts`

**Step 1:** Add import after existing imports (~line 88):
```typescript
import { getProfileAsAdmin } from '@/lib/supabase/admin';
```

**Step 2:** For each role-based test, add mock at the start:

**Test: "should allow admin role" (~line 756):**
```typescript
it('should allow admin role', async () => {
  vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
    profile: {
      id: mockUser.id,
      email: mockUser.email,
      role: 'admin',
      first_name: 'Test',
      last_name: 'User',
      phone: null,
      mfa_enabled: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  });
  // ... rest of test
```

**Test: "should reject non-admin role" (~line 774):**
```typescript
it('should reject non-admin role', async () => {
  vi.mocked(getProfileAsAdmin).mockResolvedValueOnce({
    profile: {
      id: mockUser.id,
      email: mockUser.email,
      role: 'client',  // or 'attorney'
      first_name: 'Test',
      last_name: 'User',
      phone: null,
      mfa_enabled: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    error: null,
  });
  // ... rest of test
```

Apply similar pattern to all role-based tests at lines:
- ~812 (admin)
- ~830 (client)
- ~629 (varies)
- ~651 (varies)
- ~1175 (varies)
- ~1247 (admin)
- ~1269 (client)

---

### Task 1.3: Fix Cases API Tests

**File:** `src/app/api/cases/cases.test.ts`

**Add after existing mocks (~line 263):**
```typescript
// Mock getProfileAsAdmin from admin module
vi.mock('@/lib/supabase/admin', () => ({
  getProfileAsAdmin: vi.fn().mockImplementation((userId: string) => {
    if (userId === ATTORNEY_ID) {
      return Promise.resolve({ profile: mockAttorneyProfile, error: null });
    }
    if (userId === CLIENT_ID) {
      return Promise.resolve({ profile: mockClientProfile, error: null });
    }
    if (userId === ADMIN_ID) {
      return Promise.resolve({ profile: mockAdminProfile, error: null });
    }
    if (userId === UNAUTHORIZED_USER_ID) {
      return Promise.resolve({
        profile: { ...mockClientProfile, id: UNAUTHORIZED_USER_ID },
        error: null
      });
    }
    return Promise.resolve({ profile: null, error: new Error('Profile not found') });
  }),
  getAdminClient: vi.fn(),
}));
```

---

## Phase 2: Console Migration - Jobs & Cron

### Task 2.1: Migrate cleanup.ts

**File:** `src/lib/jobs/cleanup.ts`

**Add at top of file (after existing imports):**
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('jobs:cleanup');
```

**Line-by-line replacements:**

| Line | Current | Replace With |
|------|---------|--------------|
| 266 | `console.log(\`Starting cleanup jobs (${opts.dryRun ? 'DRY RUN' : 'LIVE'})...\`)` | `log.info('Starting cleanup jobs', { dryRun: opts.dryRun, timestamp: new Date().toISOString() })` |
| 271 | `console.log('Cleaning up expired AI data...')` | `log.info('Cleaning up expired AI data')` |
| 275 | `console.log(\`AI data cleanup: ${aiResult.count} documents processed\`)` | `log.info('AI data cleanup complete', { count: aiResult.count })` |
| 282 | `console.log('Purging soft-deleted records...')` | `log.info('Purging soft-deleted records')` |
| 289 | `console.log(\`Soft delete purge: ${purgeResult.count} records processed\`)` | `log.info('Soft delete purge complete', { count: purgeResult.count })` |
| 297 | `console.log('Cleaning up old audit logs...')` | `log.info('Cleaning up old audit logs')` |
| 303 | `console.log(\`Audit log cleanup: ${auditResult.count} entries processed\`)` | `log.info('Audit log cleanup complete', { count: auditResult.count })` |
| 313 | `console.error('Cleanup completed with errors:', errors)` | `log.logError('Cleanup completed with errors', errors)` |
| 315 | `console.log('Cleanup completed successfully')` | `log.info('Cleanup completed successfully')` |
| 337 | `runCleanupJobs().catch(console.error)` | `runCleanupJobs().catch((err) => log.logError('Scheduled cleanup failed', err))` |
| 342 | `runCleanupJobs().catch(console.error)` | `runCleanupJobs().catch((err) => log.logError('Scheduled cleanup failed', err))` |
| 345 | `console.log('Cleanup jobs scheduled to run daily')` | `log.info('Cleanup jobs scheduled to run daily')` |

---

### Task 2.2: Migrate deadline-alerts/route.ts

**File:** `src/app/api/cron/deadline-alerts/route.ts`

**Add after existing imports:**
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('cron:deadline-alerts');
```

**Line-by-line replacements:**

| Line | Current | Replace With |
|------|---------|--------------|
| 28 | `console.error('CRON_SECRET not configured')` | `log.error('CRON_SECRET not configured')` |
| 43 | `console.log('[Cron] Starting deadline alerts sync...')` | `log.info('Starting deadline alerts sync')` |
| 48 | `console.log(\`[Cron] Synced ${syncCount} deadline alerts\`)` | `log.info('Synced deadline alerts', { syncCount })` |
| 57 | `console.error('[Cron] Error syncing deadline alerts:', error)` | `log.logError('Error syncing deadline alerts', error)` |

---

## Phase 3: Console Migration - Stripe

### Task 3.1: Migrate webhooks.ts

**File:** `src/lib/stripe/webhooks.ts`

**Add after existing imports:**
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('stripe:webhooks');
```

**Line-by-line replacements:**

| Line | Current | Replace With |
|------|---------|--------------|
| 59 | `console.log(\`Unhandled webhook event type: ${event.type}\`)` | `log.info('Unhandled webhook event', { eventType: event.type })` |
| 103 | `console.error('Failed to send billing email:', err)` | `log.logError('Failed to send billing email', err)` |
| 125 | `console.error('Failed to update canceled subscription:', error)` | `log.logError('Failed to update canceled subscription', error)` |
| 155 | `console.error('Failed to send cancellation email:', err)` | `log.logError('Failed to send cancellation email', err)` |
| 262 | `console.error('Failed to send payment success email:', err)` | `log.logError('Failed to send payment success email', err)` |
| 341 | `console.error('Failed to send payment failed email:', err)` | `log.logError('Failed to send payment failed email', err)` |

---

## Phase 4: Console Migration - File Validation

### Task 4.1: Migrate file-validation/index.ts

**File:** `src/lib/file-validation/index.ts`

**Add at top of file:**
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('security:file-validation');
```

**Line-by-line replacements:**

| Line | Current | Replace With |
|------|---------|--------------|
| 263 | `console.error('ClamAV API URL not configured')` | `log.error('ClamAV API URL not configured')` |
| 284 | `console.error('ClamAV scan failed:', response.status, response.statusText)` | `log.error('ClamAV scan failed', { status: response.status, statusText: response.statusText })` |
| 303 | `console.error('ClamAV scan error:', error)` | `log.logError('ClamAV scan error', error)` |
| 324 | `console.error('VirusTotal API key not configured')` | `log.error('VirusTotal API key not configured')` |
| 400 | `console.error('VirusTotal scan error:', error)` | `log.logError('VirusTotal scan error', error)` |
| 417-420 | `console.warn('Mock virus scanner...')` | `log.warn('Mock virus scanner active in production. Configure VIRUS_SCANNER_PROVIDER.')` |

---

## Phase 5: Console Migration - API Routes

### Standard Pattern

For each API route file:

**Step 1:** Add import at top:
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('api:route-name');  // e.g., 'api:auth-login', 'api:billing-checkout'
```

**Step 2:** Replace console statements:

| Pattern | Replace With |
|---------|--------------|
| `console.error('Error message:', error)` | `log.logError('Error message', error)` |
| `console.error('Error message')` | `log.error('Error message')` |
| `console.log('Info message', data)` | `log.info('Info message', { data })` |
| `console.log('Info message')` | `log.info('Info message')` |
| `console.warn('Warning message')` | `log.warn('Warning message')` |

### Files List (with console statement counts)

**Tier 1 - Auth/Security:**
- `src/app/api/auth/login/route.ts` (2)
- `src/app/api/auth/register/route.ts` (1)
- `src/app/api/2fa/setup/route.ts` (1)
- `src/app/api/2fa/verify/route.ts` (1)

**Tier 2 - Billing:**
- `src/app/api/billing/checkout/route.ts` (1)
- `src/app/api/billing/subscription/route.ts` (1)
- `src/app/api/billing/webhooks/route.ts` (1)
- `src/app/api/billing/portal/route.ts` (1)
- `src/app/api/billing/quota/route.ts` (1)
- `src/app/api/billing/cancel/route.ts` (1)
- `src/app/api/billing/resume/route.ts` (1)

**Tier 3 - Cases/Documents:**
- `src/app/api/cases/[id]/route.ts` (4)
- `src/app/api/cases/[id]/documents/route.ts` (6)
- `src/app/api/cases/[id]/completeness/route.ts` (1)
- `src/app/api/cases/[id]/success-score/route.ts` (1)
- `src/app/api/cases/stats/route.ts` (1)
- `src/app/api/documents/[id]/route.ts` (4)
- `src/app/api/documents/[id]/analyze/route.ts` (2)
- `src/app/api/forms/[id]/route.ts` (3)
- `src/app/api/forms/[id]/autofill/route.ts` (2)
- `src/app/api/forms/[id]/review/route.ts` (1)

**Tier 4 - Clients/Admin:**
- `src/app/api/clients/[id]/route.ts` (2)
- `src/app/api/clients/[id]/cases/route.ts` (1)
- `src/app/api/admin/users/route.ts` (1)
- `src/app/api/admin/users/[id]/route.ts` (1)
- `src/app/api/admin/stats/route.ts` (1)

**Tier 5 - Chat/Notifications:**
- `src/app/api/chat/route.ts` (3)
- `src/app/api/chat/[conversationId]/route.ts` (3)
- `src/app/api/document-checklists/[visaType]/route.ts` (1)

---

## Phase 6: Console Migration - Lib/Components

### Lib Files Pattern

Same as API routes - add logger import and replace console calls.

**Files with specific logger names:**

| File | Logger Name |
|------|-------------|
| `src/lib/auth/api-helpers.ts` | `auth:api-helpers` |
| `src/lib/supabase/middleware.ts` | `middleware:supabase` |
| `src/lib/config/env.ts` | `config:env` |
| `src/lib/rate-limit/index.ts` | `rate-limit` |
| `src/lib/audit/index.ts` | `audit` |
| `src/lib/ai/natural-search.ts` | `ai:natural-search` |
| `src/lib/ai/utils.ts` | `ai:utils` |
| `src/lib/ai/document-completeness.ts` | `ai:document-completeness` |
| `src/lib/email/index.ts` | `email` |
| `src/lib/email/client.ts` | `email:client` |
| `src/lib/2fa/qr-code.ts` | `2fa:qr-code` |
| `src/lib/pdf/index.ts` | `pdf` |
| `src/lib/crypto/index.ts` | `crypto` |
| `src/lib/csrf/index.ts` | `csrf` |
| `src/lib/scoring/success-probability.ts` | `scoring:success` |

### Component Files

For React components, use the same pattern but with component-appropriate logger names:

| File | Logger Name |
|------|-------------|
| `src/providers/auth-provider.tsx` | `provider:auth` |
| `src/providers/query-provider.tsx` | `provider:query` |
| `src/components/session/session-expiry-warning.tsx` | `component:session-expiry` |
| `src/components/settings/two-factor-setup.tsx` | `component:2fa-setup` |
| `src/components/error/error-boundary.tsx` | `component:error-boundary` |
| `src/app/error.tsx` | `app:error` |
| `src/app/dashboard/error.tsx` | `app:dashboard-error` |

---

## Phase 7: ESLint Cleanup

### Task 7.1: Fix Anonymous Default Exports

**Pattern:**
```typescript
// BEFORE:
export default {
  method1,
  method2,
};

// AFTER:
const moduleName = {
  method1,
  method2,
};
export default moduleName;
```

**Files and variable names:**

| File | Variable Name |
|------|---------------|
| `src/__mocks__/anthropic.ts:195` | `mockAnthropicModule` |
| `src/__mocks__/openai.ts:91` | `mockOpenAIModule` |
| `src/__mocks__/stripe.ts:164` | `mockStripeModule` |
| `src/__mocks__/supabase.ts:152` | `mockSupabaseModule` |
| `src/__mocks__/upstash.ts:93` | `mockUpstashModule` |
| `src/lib/api/handler.ts:180` | `errorHandler` |
| `src/lib/validation/index.ts:164` | `validation` |

---

### Task 7.2: Remove Unused Imports

**Run automated fix first:**
```bash
npm run lint -- --fix
```

**Then manually review remaining warnings.**

High-impact files to check:
- `src/app/dashboard/forms/page.tsx`
- `src/components/layout/header.tsx`
- `src/components/search/search-results.tsx`

---

### Task 7.3: Fix `<img>` Element

**File:** `src/components/settings/two-factor-setup.tsx`

**Find:**
```tsx
<img src={qrCodeDataUrl} alt="QR Code" ... />
```

**Replace with:**
```tsx
import Image from 'next/image';

// In the JSX:
<Image
  src={qrCodeDataUrl}
  alt="QR Code"
  width={200}
  height={200}
  unoptimized  // Required for data URLs
/>
```

---

## Verification Commands

**After each task:**
```bash
npm run build
```

**After each phase:**
```bash
npm run build
npm run test:run
```

**Final verification:**
```bash
# All tests passing
npm run test:run

# No console statements
grep -r "console\." src --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "__mocks__" | wc -l

# Minimal ESLint warnings
npm run lint 2>&1 | grep -c "warning"
```
