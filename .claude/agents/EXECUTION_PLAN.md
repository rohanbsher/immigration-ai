# Immigration AI - Consolidated Execution Plan

> Generated: 2026-01-30 17:00 after comprehensive architecture analysis

## Current State Summary

| Metric | Value |
|--------|-------|
| Build Status | ✅ Passing |
| Tests | 954/977 passing (97.9%) |
| Console Statements | 113 remaining (was 244) |
| ESLint Warnings | ~110-140 |
| API Routes with Rate Limiting | ✅ All authenticated routes covered |
| Structured Logger | ✅ DB modules migrated |

---

## Work Stream Safety Analysis

### ✅ SAFE TO WORK ON (No Agent Conflicts)

These work streams own distinct files and won't conflict with other parallel work:

| Work Stream | File Ownership | Risk Level |
|-------------|----------------|------------|
| WS-LOGGER | `src/lib/` non-db files | LOW |
| WS-LINT | Scattered imports cleanup | LOW |
| WS-TEST-FIXES | Test files only | LOW |
| WS-TECHNICAL-DEBT | Large component splits | MEDIUM |

### ⚠️ REQUIRES COORDINATION

| Work Stream | Reason | Coordination Needed |
|-------------|--------|---------------------|
| WS-UI | Affects dashboard pages | Check with frontend agents |
| WS-SDK | AI integration changes | Test thoroughly |
| WS-PRODUCTION | Feature completion | User decisions needed |

### 🚫 BLOCKED / EXTERNAL

| Item | Blocker |
|------|---------|
| Stripe setup | User must configure in Stripe Dashboard |
| Resend email | User must configure domain |
| Upstash Redis | User must create database |
| Supabase key rotation | User must do in dashboard |

---

## Prioritized Execution Plan

### PHASE A: Quick Wins (Can Start Now)

These are low-risk, high-impact items that won't conflict with any work:

#### A1. Fix Remaining Test Failures (20 tests)
**Effort:** 1-2 hours | **Impact:** HIGH (improves CI/CD reliability)

Most failures are in `src/app/api/cases/cases.test.ts` and involve:
- Auth role mock configuration issues
- Rate limit mock setup in specific tests

**Action:** Fix mock configuration in failing test files.

#### A2. ESLint Warning Cleanup
**Effort:** 1-2 hours | **Impact:** MEDIUM (cleaner codebase)

High-impact files:
- `src/app/dashboard/forms/page.tsx` (12 unused imports)
- `src/app/dashboard/cases/new/page.tsx` (3 unused)
- `src/__mocks__/*.ts` (anonymous default exports)

**Action:** Run `npm run lint -- --fix` and manually address remaining warnings.

---

### PHASE B: Code Quality (Next Priority)

#### B1. Console Statement Migration
**Effort:** 2-3 hours | **Impact:** MEDIUM (production logging)

**Current State:** 113 console statements across 50 files

**Priority Files (Production Critical):**
1. `src/lib/jobs/cleanup.ts` (12 statements)
2. `src/lib/file-validation/index.ts` (6 statements)
3. `src/lib/stripe/webhooks.ts` (6 statements)
4. `src/lib/audit/index.ts` (6 statements)
5. `src/app/api/cases/[id]/documents/route.ts` (6 statements)

**Action:** Import `createLogger` and replace console.* calls.

#### B2. Empty Catch Block Review (24 instances)
**Effort:** 1-2 hours | **Impact:** LOW-MEDIUM

**Action:** Add structured logging to catch blocks or add comments explaining intentional silence.

---

### PHASE C: UI/UX Completion (If Time Allows)

#### C1. Missing UI Components
**Status:** APIs exist but no frontend

| Feature | API Location | UI Needed |
|---------|--------------|-----------|
| Case success score | `/api/cases/[id]/success-score` | Score display component |
| Case recommendations | `/api/cases/[id]/recommendations` | Recommendations panel |
| Document completeness | `/api/cases/[id]/completeness` | Checklist component |
| Task comments | `/api/tasks/[id]/comments` | Comment thread |
| Activity feed | `/api/cases/[id]/activities` | Timeline component |

**Note:** These require frontend development and should be coordinated with any UI agents.

---

### PHASE D: SDK Upgrades (Requires Testing)

#### D1. OpenAI SDK Upgrade (4.100.0 → 6.x)
**Risk:** HIGH (breaking changes)

**Pre-requisites:**
1. Review OpenAI v6 migration guide
2. Identify all usage in `src/lib/ai/`
3. Create test plan for document analysis

**Affected Files:**
- `src/lib/ai/openai.ts`
- `src/lib/ai/index.ts`
- Any file importing OpenAI types

---

### PHASE E: Production Feature Completion

#### E1. Invitation Email Integration
**File:** `src/lib/db/firms.ts` → `createInvitation`
**Status:** Template exists, needs hook-up

#### E2. Billing Usage Display
**File:** `src/app/dashboard/billing/page.tsx`
**Status:** UI exists, needs data fetching

#### E3. Firm Switcher (Multi-Firm Users)
**File:** `src/app/dashboard/firm/page.tsx`
**Status:** Requires design decision

---

## Recommended Execution Order

```
START
  │
  ├─> [A1] Fix 20 test failures (1-2 hrs)
  │
  ├─> [A2] ESLint cleanup (1-2 hrs)
  │
  ├─> [B1] Console statement migration (2-3 hrs)
  │     Priority: jobs, validation, webhooks, audit
  │
  ├─> [B2] Empty catch blocks (1-2 hrs)
  │
  ├─> CHECKPOINT: Run build + tests
  │
  ├─> [C1] UI components (if user requests)
  │
  ├─> [D1] OpenAI SDK upgrade (HIGH RISK - separate session)
  │
  └─> [E1-E3] Production features (requires user input)
```

---

## Safety Checklist Before Each Phase

1. [ ] Run `npm run build` - verify no TypeScript errors
2. [ ] Run `npm run test:run` - check current pass rate
3. [ ] Check `.claude/agents/TODO.md` for conflicts
4. [ ] Note files you'll modify to avoid conflicts

---

## Files This Plan Will Touch

### Phase A (Tests & Lint)
- `src/app/api/cases/cases.test.ts`
- `src/lib/auth/index.test.ts`
- `src/lib/ai/index.test.ts`
- Various dashboard pages (import cleanup)
- `src/__mocks__/*.ts`

### Phase B (Code Quality)
- `src/lib/jobs/cleanup.ts`
- `src/lib/file-validation/index.ts`
- `src/lib/stripe/webhooks.ts`
- `src/lib/audit/index.ts`
- Various API routes

### Phase C (UI - Coordination Required)
- `src/app/dashboard/cases/[id]/page.tsx`
- `src/components/cases/*`
- New components to create

### Phase D (SDK - High Risk)
- `src/lib/ai/openai.ts`
- `src/lib/ai/index.ts`
- Related test files

---

## Questions for User Before Proceeding

1. **Priority Order:** Should I start with test fixes (quick stability win) or console migration (better production logging)?

2. **UI Components:** Are the missing UI components (success score, recommendations, etc.) a priority, or should I focus on code quality first?

3. **OpenAI Upgrade:** Is the OpenAI SDK upgrade urgent, or can it wait until other cleanup is done?

4. **Production Features:** Which production feature is most important?
   - Invitation emails
   - Billing usage display
   - Firm switcher

---

## Session Handoff Notes

If another agent picks up this work:

- **Rate limiting is COMPLETE** - all 24+ authenticated routes have it
- **DB modules are DONE** - already migrated to structured logger
- **Build passes** - use `ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build`
- **Test pass rate is 97.9%** - 20 failures remain, mostly auth mock issues
- **Console statements** - 113 remaining (priority: lib/ files)
