# Immigration AI - Agent Task List

> Last updated: 2026-01-30 17:30 (Production Readiness Plan Created)

## Current Execution Plan: Production Readiness

**Goal:** Achieve production-ready state with all tests passing and clean codebase
**Total Estimated Time:** 12-18 hours across 7 phases
**Detailed Plan:** See `.claude/agents/EXECUTION_PLAN.md` for line-by-line implementation details

### Progress Tracker

| Phase | Description | Status | Tests | Console Stmts |
|-------|-------------|--------|-------|---------------|
| 1 | Fix 20 test failures | NOT STARTED | 954/977 | - |
| 2 | Console migration - Jobs/Cron | NOT STARTED | - | 16 remaining |
| 3 | Console migration - Stripe | NOT STARTED | - | 6 remaining |
| 4 | Console migration - File Validation | NOT STARTED | - | 6 remaining |
| 5 | Console migration - API Routes | NOT STARTED | - | ~150 remaining |
| 6 | Console migration - Lib/Components | NOT STARTED | - | ~55 remaining |
| 7 | ESLint cleanup | NOT STARTED | - | - |

---

## Phase 1: Fix Test Failures (PRIORITY: CRITICAL)

**Estimated Time:** 2-3 hours
**Files:** 3
**Blocking:** All other phases should wait for tests to pass

### Tasks

- [ ] **1.1** Fix AI error message in `src/lib/ai/utils.ts:68`
  - Change: `'No JSON found in response'` → `'Could not parse JSON response from Claude'`
  - Verification: `npm run test:run -- src/lib/ai/index.test.ts`

- [ ] **1.2** Fix auth tests in `src/lib/auth/index.test.ts`
  - Add import: `import { getProfileAsAdmin } from '@/lib/supabase/admin';`
  - Add `mockResolvedValueOnce` for each role-based test (~9 tests)
  - Tests at lines: ~756, ~774, ~812, ~830, ~629, ~651, ~1175, ~1247, ~1269
  - Verification: `npm run test:run -- src/lib/auth/index.test.ts`

- [ ] **1.3** Fix cases API tests in `src/app/api/cases/cases.test.ts`
  - Add mock: `vi.mock('@/lib/supabase/admin', () => ({ getProfileAsAdmin: vi.fn()... }))`
  - Add after existing mocks (~line 263)
  - Verification: `npm run test:run -- src/app/api/cases/cases.test.ts`

### Phase 1 Checkpoint
```bash
npm run test:run  # Expected: 974/977 passing
npm run build     # Expected: Success
```

---

## Phase 2: Console Migration - Jobs & Cron (16 statements)

**Estimated Time:** 1-2 hours
**Files:** 2
**Can run parallel with Phase 3**

### Tasks

- [ ] **2.1** Migrate `src/lib/jobs/cleanup.ts` (12 statements)
  - Add: `import { createLogger } from '@/lib/logger'; const log = createLogger('jobs:cleanup');`
  - Replace 12 console.* calls with log.* calls
  - See EXECUTION_PLAN.md for line-by-line details

- [ ] **2.2** Migrate `src/app/api/cron/deadline-alerts/route.ts` (4 statements)
  - Add: `import { createLogger } from '@/lib/logger'; const log = createLogger('cron:deadline-alerts');`
  - Replace 4 console.* calls with log.* calls

### Phase 2 Checkpoint
```bash
npm run build
npm run test:run
```

---

## Phase 3: Console Migration - Stripe (6 statements)

**Estimated Time:** 30 minutes
**Files:** 1
**Can run parallel with Phase 2**

### Tasks

- [ ] **3.1** Migrate `src/lib/stripe/webhooks.ts` (6 statements)
  - Add: `import { createLogger } from '@/lib/logger'; const log = createLogger('stripe:webhooks');`
  - Replace 6 console.* calls with log.* calls
  - Lines: 59, 103, 125, 155, 262, 341

---

## Phase 4: Console Migration - File Validation (6 statements)

**Estimated Time:** 30 minutes
**Files:** 1

### Tasks

- [ ] **4.1** Migrate `src/lib/file-validation/index.ts` (6 statements)
  - Add: `import { createLogger } from '@/lib/logger'; const log = createLogger('security:file-validation');`
  - Replace 6 console.* calls with log.* calls
  - Lines: 263, 284, 303, 324, 400, 417-420

---

## Phase 5: Console Migration - API Routes (~150 statements)

**Estimated Time:** 4-6 hours
**Files:** 47

### Pattern
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('api:route-name');

// console.error('Error:', error) → log.logError('Error', error)
// console.log('message', data) → log.info('message', { data })
```

### Tasks (Tier 1 - Auth/Security)
- [ ] **5.1** `src/app/api/auth/login/route.ts`
- [ ] **5.2** `src/app/api/auth/register/route.ts`
- [ ] **5.3** `src/app/api/2fa/setup/route.ts`
- [ ] **5.4** `src/app/api/2fa/verify/route.ts`

### Tasks (Tier 2 - Billing)
- [ ] **5.5** `src/app/api/billing/checkout/route.ts`
- [ ] **5.6** `src/app/api/billing/subscription/route.ts`
- [ ] **5.7** `src/app/api/billing/webhooks/route.ts`
- [ ] **5.8** `src/app/api/billing/portal/route.ts`
- [ ] **5.9** `src/app/api/billing/quota/route.ts`

### Tasks (Tier 3 - Cases/Documents)
- [ ] **5.10** `src/app/api/cases/[id]/route.ts`
- [ ] **5.11** `src/app/api/cases/[id]/documents/route.ts`
- [ ] **5.12** `src/app/api/documents/[id]/route.ts`
- [ ] **5.13** `src/app/api/documents/[id]/analyze/route.ts`
- [ ] **5.14** `src/app/api/forms/[id]/route.ts`
- [ ] **5.15** `src/app/api/forms/[id]/autofill/route.ts`

### Tasks (Tier 4 - Remaining)
- [ ] **5.16** All other API routes with console statements
  - Use grep to find: `grep -r "console\." src/app/api --include="*.ts"`

### Phase 5 Checkpoint
```bash
npm run build
grep -r "console\." src/app/api --include="*.ts" | wc -l  # Should be 0
```

---

## Phase 6: Console Migration - Lib/Components (~55 statements)

**Estimated Time:** 2-3 hours
**Files:** 23

### Tasks (Lib Files)
- [ ] **6.1** `src/lib/auth/api-helpers.ts` (3 statements)
- [ ] **6.2** `src/lib/supabase/middleware.ts` (3 statements)
- [ ] **6.3** `src/lib/config/env.ts` (4 statements)
- [ ] **6.4** `src/lib/rate-limit/index.ts` (3 statements)
- [ ] **6.5** `src/lib/audit/index.ts` (6 statements)
- [ ] **6.6** `src/lib/ai/natural-search.ts` (2 statements)
- [ ] **6.7** `src/lib/ai/utils.ts` (1 statement)
- [ ] **6.8** `src/lib/ai/document-completeness.ts` (2 statements)
- [ ] **6.9** `src/lib/email/index.ts` (4 statements)
- [ ] **6.10** `src/lib/email/client.ts` (1 statement)
- [ ] **6.11** `src/lib/2fa/qr-code.ts` (2 statements)
- [ ] **6.12** `src/lib/pdf/index.ts` (1 statement)
- [ ] **6.13** `src/lib/crypto/index.ts` (1 statement)
- [ ] **6.14** `src/lib/csrf/index.ts` (1 statement)
- [ ] **6.15** `src/lib/scoring/success-probability.ts` (1 statement)

### Tasks (Component/Provider Files)
- [ ] **6.16** `src/providers/auth-provider.tsx` (1 statement)
- [ ] **6.17** `src/providers/query-provider.tsx` (1 statement)
- [ ] **6.18** `src/components/session/session-expiry-warning.tsx` (2 statements)
- [ ] **6.19** `src/components/settings/two-factor-setup.tsx` (1 statement)
- [ ] **6.20** `src/components/error/error-boundary.tsx` (1 statement)
- [ ] **6.21** `src/app/error.tsx` (1 statement)
- [ ] **6.22** `src/app/dashboard/error.tsx` (1 statement)

### Phase 6 Checkpoint
```bash
npm run build
grep -r "console\." src --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "__mocks__" | wc -l
# Expected: Near 0
```

---

## Phase 7: ESLint Cleanup

**Estimated Time:** 2-3 hours
**Files:** ~20

### Tasks

- [ ] **7.1** Fix anonymous default exports (7 files)
  - `src/__mocks__/anthropic.ts:195`
  - `src/__mocks__/openai.ts:91`
  - `src/__mocks__/stripe.ts:164`
  - `src/__mocks__/supabase.ts:152`
  - `src/__mocks__/upstash.ts:93`
  - `src/lib/api/handler.ts:180`
  - `src/lib/validation/index.ts:164`

- [ ] **7.2** Remove unused imports
  - Run: `npm run lint -- --fix`
  - Manually fix remaining warnings

- [ ] **7.3** Fix `<img>` element in `src/components/settings/two-factor-setup.tsx`
  - Replace with `<Image>` from next/image

### Phase 7 Checkpoint
```bash
npm run lint 2>&1 | grep -c "warning"  # Expected: <10
npm run build
npm run test:run
```

---

## Final Verification

```bash
# All tests passing
npm run test:run
# Expected: 974/977 passing (3 skipped)

# Build succeeds
npm run build

# No console statements in production code
grep -r "console\." src --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "__mocks__" | wc -l
# Expected: 0

# Minimal ESLint warnings
npm run lint 2>&1 | grep -c "warning"
# Expected: <10
```

---

## Success Criteria

- [ ] All 974 tests passing (20 fixed, 3 skipped)
- [ ] Build succeeds with no errors
- [ ] 0 console statements in production code
- [ ] <10 ESLint warnings (intentional only)
- [ ] All changes committed with conventional commits

---

## Completed Work Streams (Reference)

### WS-AUDIT: Production Readiness Audit
- [x] Verify security (.gitignore, Next.js version)
- [x] Verify auth timeouts (use-user.ts, use-auth.ts)
- [x] Enhance env validation for production
- [x] Fix React purity violation in ai-loading.tsx
- [x] Migrate cases.ts to structured logger

### WS-CRITICAL-BUGS: Production Critical Bug Fixes
- [x] P0-1: Fix auth loading bug
- [x] P0-2: Fix 401 errors
- [x] P0-3: Add login timeout
- [x] P0-4: Fix test mocks (89→20 failures)
- [x] P0-5: Next.js upgrade

### WS-REMEDIATION: Codebase Audit (Phases 1-3)
- [x] 6/6 Critical issues fixed
- [x] 8/8 High priority issues fixed
- [x] Rate limiting added to 24+ routes
- [x] Unified permissions system created

---

## Notes for Agents

### Before Starting Work
1. Read this TODO.md to find your next task
2. Read `.claude/agents/EXECUTION_PLAN.md` for detailed implementation steps
3. Check current phase status and pick up where previous agent left off
4. Run `npm run build && npm run test:run` to verify starting state

### During Work
1. Mark task as started: Change `[ ]` to `[~]`
2. Follow the exact code changes in EXECUTION_PLAN.md
3. Run verification after each task

### After Completing Work
1. Mark task as done: Change `[~]` to `[x]`
2. Update phase status in Progress Tracker table
3. Create session log in `.claude/agents/sessions/`
4. Run full verification before handing off

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build (must pass)
npm run test:run     # Run tests
npm run lint         # Check for lint issues

# Build requires this env var if Redis not configured:
ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build
```
