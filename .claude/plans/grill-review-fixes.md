# Plan: Grill Review Fixes

> Addressing issues identified in staff engineer code review.
> **Audited by 3 sub-agents on 2026-02-03**

## Issues to Fix (Priority Order)

### 🚨 Critical Issues

#### Issue 1: Add tests for `/api/billing/usage` endpoint
**File to create:** `src/app/api/billing/usage/route.test.ts`

**Test cases needed:**
1. Returns 401 when unauthenticated
2. Returns 429 when rate limited
3. Returns correct usage data shape for authenticated user
4. Handles checkQuota errors gracefully
5. Returns correct values from quota service

**Implementation:**
```typescript
// Mock serverAuth, standardRateLimiter, checkQuota
// Test each scenario - follows pattern in src/app/api/clients/clients.test.ts
```

---

#### Issue 2: Dedupe UsageData interface
**Files affected:**
- `src/app/api/billing/usage/route.ts` (remove interface, add import)
- `src/hooks/use-subscription.ts` (remove interface, add import)
- `src/types/billing.ts` (CREATE - single source of truth)

**Implementation:**
1. Create `src/types/billing.ts` with UsageData interface
2. Add `import type { UsageData } from '@/types/billing';` to both files
3. Remove duplicate definitions from both files

**Audit confirmed:** Only these 2 files need updates.

---

#### Issue 3: Add DB migration for unique constraint
**AUDIT CONFIRMED:** Constraint is MISSING - CRITICAL SECURITY ISSUE

**Current state** (from `007_two_factor_auth.sql`):
```sql
CREATE TABLE backup_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  two_factor_id UUID NOT NULL REFERENCES two_factor_auth(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  -- NO UNIQUE CONSTRAINT!
);
```

**Migration file:** `supabase/migrations/031_add_backup_code_unique_constraint.sql`

```sql
-- Migration: 031_add_backup_code_unique_constraint.sql
-- Description: Add unique constraint to prevent race condition in backup code usage
-- Security: Without this constraint, the same backup code can be used multiple times

-- First, verify no duplicates exist (run manually before migration)
-- SELECT two_factor_id, code_hash, COUNT(*) FROM backup_code_usage
-- GROUP BY two_factor_id, code_hash HAVING COUNT(*) > 1;

ALTER TABLE backup_code_usage
  ADD CONSTRAINT backup_code_usage_unique UNIQUE (two_factor_id, code_hash);
```

**Pre-migration check required:** Query for duplicates before applying.

---

### ⚠️ High Priority Issues

#### Issue 4: Fix hardcoded `documents: 0`
**Files:**
- `src/lib/billing/quota.ts` (add documents case to `getCurrentUsage`)
- `src/app/api/billing/usage/route.ts` (call checkQuota for documents)

**AUDIT FINDING:** `getCurrentUsage()` is missing `case 'documents':` handler - falls through to `default: return 0`

**Implementation in quota.ts:**
```typescript
// Add new case in getCurrentUsage() switch statement (before default):
case 'documents': {
  // Count all documents uploaded by user across all their cases
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('uploaded_by', userId)
    .is('deleted_at', null);
  return count || 0;
}
```

**Update usage route to call it:**
```typescript
const [casesQuota, docsQuota, aiQuota, teamQuota] = await Promise.all([
  checkQuota(user.id, 'cases'),
  checkQuota(user.id, 'documents'),  // ADD THIS
  checkQuota(user.id, 'ai_requests'),
  checkQuota(user.id, 'team_members'),
]);

const usage: UsageData = {
  cases: casesQuota.current,
  documents: docsQuota.current,  // USE ACTUAL VALUE
  aiRequests: aiQuota.current,
  teamMembers: teamQuota.current,
};
```

---

#### Issue 5: Make error logging consistent
**File:** `src/lib/stripe/webhooks.ts`

**AUDIT CONFIRMED:** Logger signature is `logError(message, error, context?)` - error is 2nd positional param

**Current state:**
- ✅ Line 167: `log.logError('Failed to update...', error)` - CORRECT
- ❌ Lines 142, 198, 290, 370: `log.logError('msg', { error: message })` - WRONG

**Fix:** Change all incorrect lines to pass error directly:
```typescript
// WRONG:
.catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown error';
  log.logError('Failed to send billing email', { error: message });
});

// CORRECT:
.catch((err: unknown) => {
  log.logError('Failed to send billing email', err);
});
```

---

#### Issue 6: Fix unsafe type narrowing for Stripe subscription
**File:** `src/lib/stripe/webhooks.ts` (lines 223-225, 314-316)

**AUDIT CONFIRMED:** Unsafe casting pattern exists at both locations.

**Add helper function at top of file:**
```typescript
/**
 * Safely extract subscription ID from Stripe invoice subscription field.
 * Handles string IDs, expanded Subscription objects, and null/undefined.
 */
function getSubscriptionId(sub: string | Stripe.Subscription | null | undefined): string | null {
  if (typeof sub === 'string') return sub;
  if (sub && typeof sub === 'object' && 'id' in sub) return sub.id;
  return null;
}
```

**Replace unsafe casts:**
```typescript
// BEFORE (lines 223-225):
const stripeSubId = typeof inv.subscription === 'string'
  ? inv.subscription
  : (inv.subscription as Stripe.Subscription | null)?.id;

// AFTER:
const stripeSubId = getSubscriptionId(inv.subscription);
```

---

### Medium Priority Issues

#### Issue 7: Handle useUsage hook errors in billing page
**File:** `src/app/dashboard/billing/page.tsx`

**Implementation:**
```typescript
const { data: usage, error: usageError } = useUsage();

// Add after {limits && (... section, around line 130:
{usageError && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm">
    Unable to load usage data. Your limits are still enforced.
  </div>
)}
```

---

#### Issue 8: Remove redundant ExtendedStripeSubscription
**File:** `src/lib/stripe/webhooks.ts`

**AUDIT CONFIRMED:** `ExtendedStripeSubscription` is REDUNDANT.

`current_period_end` is NOT in official Stripe types but the interface attempts to add it. The actual field comes from the Stripe API response but isn't typed.

**Fix:** Remove the interface and access the field via type assertion only where needed:
```typescript
// REMOVE this interface:
interface ExtendedStripeSubscription extends Stripe.Subscription {
  current_period_end?: number;
}

// CHANGE usage at lines 125, 184 to:
const periodEnd = (subscription as { current_period_end?: number }).current_period_end;
```

Alternatively, keep the interface but add explanatory comment:
```typescript
/**
 * Extended subscription interface.
 * Note: current_period_end exists in Stripe API responses but is not
 * included in @types/stripe. This interface provides type-safe access.
 */
interface ExtendedStripeSubscription extends Stripe.Subscription {
  current_period_end?: number;
}
```

---

## Implementation Order

1. **Issue 2** - Dedupe interface (foundation for other changes)
2. **Issue 4** - Fix documents count in quota.ts (needed before tests)
3. **Issue 1** - Add tests (validates endpoint with real logic)
4. **Issue 3** - DB migration (security-critical, run duplicate check first)
5. **Issue 6** - Type narrowing fix (add helper function)
6. **Issue 5** - Error logging consistency (simple fix)
7. **Issue 8** - Clean Stripe types (add comment or remove)
8. **Issue 7** - Error handling in UI (polish)

## Verification

```bash
# Step 1: After Issue 2 (interface move)
npx tsc --noEmit --skipLibCheck  # Verify imports work

# Step 2: After Issue 4 (quota.ts changes)
npm test -- quota.test.ts        # Run quota tests if they exist

# Step 3: After Issue 1 (new tests)
npm test -- route.test.ts        # Run new tests
npm test                          # All tests pass

# Step 4: Before Issue 3 (DB migration)
# Run in Supabase SQL editor:
SELECT two_factor_id, code_hash, COUNT(*)
FROM backup_code_usage
GROUP BY two_factor_id, code_hash
HAVING COUNT(*) > 1;
# Should return 0 rows - then apply migration

# Final verification:
npx tsc --noEmit --skipLibCheck  # Type check
npm run lint                      # Lint check
npm test                          # All tests pass
npm run build                     # Build succeeds
```

## Files to Modify

| File | Action | Issue |
|------|--------|-------|
| `src/types/billing.ts` | CREATE | #2 |
| `src/app/api/billing/usage/route.ts` | MODIFY | #2, #4 |
| `src/app/api/billing/usage/route.test.ts` | CREATE | #1 |
| `src/hooks/use-subscription.ts` | MODIFY | #2 |
| `src/lib/billing/quota.ts` | MODIFY | #4 |
| `src/lib/stripe/webhooks.ts` | MODIFY | #5, #6, #8 |
| `src/app/dashboard/billing/page.tsx` | MODIFY | #7 |
| `supabase/migrations/031_add_backup_code_unique_constraint.sql` | CREATE | #3 |

## Success Criteria

- [ ] All 8 issues addressed
- [ ] TypeScript compiles without errors
- [ ] All tests pass (including new ones for usage endpoint)
- [ ] No new lint errors introduced
- [ ] UsageData interface defined in single location (`src/types/billing.ts`)
- [ ] Billing page shows actual document count (not 0)
- [ ] 2FA backup code race condition properly guarded by DB constraint
- [ ] Error logging uses consistent `logError(msg, error)` pattern
- [ ] Stripe subscription ID extraction uses type-safe helper function

## Audit Trail

| Audit Agent | Focus | Key Finding |
|-------------|-------|-------------|
| DB Migration | Issue 3 | Constraint MISSING - migration required |
| Stripe/Logging | Issues 5,6,8 | logError signature confirmed; ExtendedStripeSubscription redundant |
| Completeness | All issues | Documents metric missing from getCurrentUsage() |
