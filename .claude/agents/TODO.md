# Immigration AI - Agent Task List

> Last updated: 2026-02-05 (Plan-and-Fix + Production Readiness Audit)

## Completed Execution Plans

All three implementation plans have been verified as 100% complete.

### Bug Fix Implementation Plan (7/7 DONE)
- [x] **P0** Fix updateMessage metadata clobbering — atomic JSONB merge via RPC
- [x] **P0** Fix document status race condition — statusWasSet flag
- [x] **P1** Extract validateStorageUrl to shared module
- [x] **P1** Add SSE keepalive mechanism
- [x] **P1** Add SECURITY DEFINER to quota triggers
- [x] **P2** Normalize email on invitation insert
- [x] **P3** Clean up placeholder tests

### Grill Review Fix Plan (9/9 DONE)
- [x] Fix MockFile/MockBlob missing interface methods
- [x] Create test-utils barrel export
- [x] Fix non-deterministic random in createMockNavItems
- [x] Scope vercel.json cache headers to API routes
- [x] Fix Stripe webhook type handling
- [x] Add RPC fallback path tests
- [x] Move beforeAll polyfill to setupTests.ts
- [x] Deduplicate magic bytes (single FILE_SIGNATURES export)
- [x] Fix inconsistent error handling in Stripe webhooks

### Execution Plan Phases (7/7 DONE)
- [x] **Phase 1:** Fix 20 test failures (AI error message, auth mocks, cases mocks)
- [x] **Phase 2:** Console migration — Jobs/Cron (2 files, 16 statements)
- [x] **Phase 3:** Console migration — Stripe (1 file, 6 statements)
- [x] **Phase 4:** Console migration — File Validation (1 file, 6 statements)
- [x] **Phase 5:** Console migration — API Routes (30+ files, ~150 statements)
- [x] **Phase 6:** Console migration — Lib/Components (20+ files, ~55 statements)
- [x] **Phase 7:** ESLint cleanup (anonymous exports, Image component, unused imports)

---

## Current State

```
Tests:  1,589 passed | 3 skipped | 0 failures
Build:  Passes
Lint:   1 error (pre-existing) | 153 warnings (unused vars in E2E tests)
Console: 0 statements in production code
```

---

## Open Work Streams (Available for New Agents)

### WS-1: Billing UI (COMPLETE)
**Status:** Shipped 2026-02-05
**Files:** `src/app/dashboard/billing/`, `src/components/billing/`
**Tasks:**
- [x] Build subscription management page
- [x] Build checkout flow component
- [x] Build usage meter display
- [x] Build plan comparison table
- [x] Build upgrade/downgrade flow
- [x] Test Stripe webhook integration end-to-end

### WS-2: Multi-Tenancy UI (COMPLETE)
**Status:** Shipped 2026-02-05
**Files:** `src/app/dashboard/firm/`, `src/components/firm/`
**Tasks:**
- [x] Build firm switcher component
- [x] Build team invitation flow
- [x] Build firm settings page
- [x] Build member management UI

### WS-3: Email Notifications (COMPLETE)
**Status:** Shipped 2026-02-05
**Files:** `src/lib/email/`
**Tasks:**
- [x] Create email templates (welcome, case update, deadline, invitation)
- [x] Configure Resend for production
- [x] Wire up notification triggers
- [x] Build notification preferences UI

### WS-BASESERVICE: BaseService Migration (COMPLETE)
**Status:** All 12 services migrated to BaseService pattern
**Files:** `src/lib/db/*.ts`
**Tasks:**
- [x] Migrate activities.ts to BaseService
- [x] Migrate case-messages.ts to BaseService
- [x] Migrate cases.ts to BaseService
- [x] Migrate conversations.ts to BaseService (preserved backward-compatible function exports)
- [x] Migrate document-requests.ts to BaseService
- [x] Migrate documents.ts to BaseService (preserved encryption/audit logic)
- [x] Migrate forms.ts to BaseService
- [x] Migrate notifications.ts to BaseService (preserved graceful degradation in getUnreadCount)
- [x] Migrate profiles.ts to BaseService (preserved graceful degradation in searchProfiles)
- [x] Migrate subscriptions.ts to BaseService (preserved backward-compatible function exports)
- [x] Fix analyze route tests for CAS protection mock compatibility
- [x] Verify all 1,293 tests pass and build succeeds

### WS-PLANFIX: Plan-and-Fix Backlog (COMPLETE)
**Status:** All 3 groups implemented, build + tests pass
**Tasks:**
- [x] Group A: fetchWithTimeout in two-factor-setup.tsx, client-dashboard.tsx, document-checklist.tsx
- [x] Group B: Form data sync fix in forms/[id]/page.tsx (isInitialized flag)
- [x] Group C: Document upload partial failure (Promise.allSettled + retry)

### WS-PROD-FIXES: Production Readiness Fixes (COMPLETE)
**Status:** Shipped 2026-02-06 — Score 83→~92/100
**Tasks:**
- [x] Fix 1: AI API timeout configuration (OpenAI + Anthropic constructors)
- [x] Fix 2: Admin/settings bare fetch → fetchWithTimeout (6 call sites)
- [x] Fix 3: Form autofill CAS race condition (autofilling status + rollback)
- [x] Fix 4: Missing admin pages (subscriptions, audit-logs, system)
- [x] Fix 5: Auth error message standardization (prevent enumeration)
- [x] Fix 6: N+1 quota query → Supabase RPC with fallback
- [x] Fix 7: Update stale documentation

### WS-AUDIT-FIXES: Production Readiness Audit Findings (MOSTLY COMPLETE)
**Status:** Core fixes done via WS-PROD-FIXES + WS-PROD-READINESS. Remaining items below.
**Tasks:**
- [x] Migrate admin dashboard pages to fetchWithTimeout
- [x] Fix forms list N+1 aggregation query
- [x] Add tests for success-probability scoring (30 tests)
- [x] Add tests for GDPR routes (27 tests)
- [x] Add retry utility with tests (21 tests)
- [x] Add error boundaries with Sentry integration
- [x] Add loading states for 5 dashboard routes
- [x] Add migrations README documentation
- [ ] Include documents/AI conversations in GDPR data export
- [ ] Review Redis fail-closed behavior for production safety

### WS-UI: Missing UI Components (LOW PRIORITY)
**Tasks:**
- [ ] Client portal view
- [ ] Analytics dashboard
- [ ] Document request UI
- [ ] Task management UI

### WS-LINT: ESLint Warnings (LOW PRIORITY)
**Tasks:**
- [ ] Fix 149 remaining warnings (mostly @typescript-eslint/no-unused-vars in E2E tests)

---

## Completed Work Streams (Reference)

### WS-AUDIT: Production Readiness Audit (COMPLETE)
- [x] Verify security (.gitignore, Next.js version)
- [x] Verify auth timeouts (use-user.ts, use-auth.ts)
- [x] Enhance env validation for production
- [x] Fix React purity violation in ai-loading.tsx
- [x] Migrate cases.ts to structured logger

### WS-CRITICAL-BUGS: Production Critical Bug Fixes (COMPLETE)
- [x] P0-1: Fix auth loading bug
- [x] P0-2: Fix 401 errors
- [x] P0-3: Add login timeout
- [x] P0-4: Fix test mocks (89 to 20 failures)
- [x] P0-5: Next.js upgrade

### WS-REMEDIATION: Codebase Audit Phases 1-3 (COMPLETE)
- [x] 6/6 Critical issues fixed
- [x] 8/8 High priority issues fixed
- [x] Rate limiting added to 24+ routes
- [x] Unified permissions system created

### WS-CONSOLE: Console Migration (COMPLETE)
- [x] All 7 phases complete
- [x] 0 console.* statements in production code

### WS-BUGFIX: Bug Fix Plan (COMPLETE)
- [x] 7/7 bug fixes implemented and verified

### WS-GRILL: Staff Engineer Review Fixes (COMPLETE)
- [x] 9/9 issues fixed and verified

---

## Notes for Agents

### Before Starting Work
1. Read `.claude/CONTEXT.md` for current project state
2. Read this TODO.md to find available work
3. Run `ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build && npm run test:run` to verify starting state
4. Claim a work stream before starting

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test:run     # Run tests (1,589 passing)
npm run lint         # Check lint issues

# Build requires this env var if Redis not configured:
ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build
```
