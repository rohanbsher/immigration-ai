# Immigration AI - Agent Task List

> Last updated: 2026-02-09 (Production Readiness Audit Complete)

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

## Current State (2026-02-09)

```
Tests:  1,591 passed | 3 skipped | 0 failures
Build:  Passes (68 routes, no TypeScript errors)
Lint:   1 error (pre-existing) | 153 warnings (unused vars in E2E tests)
Coverage: 82.96% statements | 71.61% branches | 85.19% functions
```

---

## Open Work Streams

### WS-TESTS-P1: Security-Critical API Route Tests (HIGH PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned
**Estimated Effort:** 15-20 hours
**Tasks:**
- [ ] 2FA route tests (5 endpoints: setup, verify, status, backup-codes, disable)
- [ ] Admin route tests (5 endpoints: stats, users, user detail, suspend, unsuspend)
- [ ] Billing route tests (7 endpoints: checkout, portal, cancel, resume, subscription, quota, webhooks)

### WS-TESTS-P2: Feature API Route Tests (MEDIUM PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned
**Estimated Effort:** 12-16 hours
**Tasks:**
- [ ] Chat route tests (2 endpoints: POST /api/chat, GET /api/chat/[conversationId])
- [ ] Notification route tests (5 endpoints)
- [ ] Cron route tests (deadline-alerts)
- [ ] Health endpoint tests
- [ ] Profile endpoint tests
- [ ] Task management route tests
- [ ] Document request route tests

### WS-TESTS-P3: Frontend Tests (LOW PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned
**Estimated Effort:** 30-40 hours
**Tasks:**
- [ ] Component unit tests (target top 20 critical components first)
- [ ] Hook tests (target top 10 custom hooks first)
- [ ] Target: 40%+ component coverage, 60%+ hook coverage

### WS-INFRA: Infrastructure Setup (USER ACTION + GUIDANCE)
**Status:** In progress — user setting up prod instances
**Tasks:**
- [ ] Supabase production instance + run 39 migrations
- [ ] Generate ENCRYPTION_KEY and CRON_SECRET
- [ ] Configure virus scanner (ClamAV or VirusTotal)
- [ ] Set AI API keys (OpenAI + Anthropic)
- [ ] Set NEXT_PUBLIC_APP_URL to production domain
- [ ] Configure Upstash Redis for rate limiting
- [ ] Configure Resend for email
- [ ] Configure Sentry for error tracking
- [ ] Configure Stripe (if monetizing)
- [ ] Deploy to Vercel

### WS-REMAINING: Non-Blocking Improvements
**Tasks:**
- [ ] Include documents/AI conversations in GDPR data export
- [ ] Fix 149 ESLint warnings (mostly unused vars in E2E tests)
- [ ] Add Dockerfile for self-hosted deployments

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
