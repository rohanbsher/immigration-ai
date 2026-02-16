# Immigration AI - Agent Task List

> Last updated: 2026-02-16 (Form definitions, doc types, PDF engine updates)

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

## Current State (2026-02-16)

```
Tests:  2,182+ passed | 3 skipped | 0 failures (unit)
        86 passed | 67 skipped | 0 failures (E2E in CI)
Build:  Passes (69 routes, no TypeScript errors)
Coverage: 86%+ statements
Migrations: 37 SQL files (001-044, some gaps)
```

> **Full launch tracker: `.claude/LAUNCH_TRACKER.md`**

---

## Launch-Blocking Work Streams

### WS-PDF: USCIS PDF Generation (CRITICAL — #1 BLOCKER)
**Status:** Partially Complete
**Assigned Agent:** Unassigned (api-db)
**Priority:** CRITICAL — attorneys cannot file without this
**Details:** See LAUNCH_TRACKER.md → Blocker 1
**Progress:** XFA filler engine exists (`src/lib/pdf/xfa-filler.ts`), Railway microservice exists (`services/pdf-service/`), 7 USCIS templates on disk, 141 AcroForm field mappings
**Tasks:**
- [ ] PDF-1: Obtain official USCIS fillable PDF templates (I-130, I-485, I-765, I-131, N-400, I-140)
- [x] PDF-2: Build AcroForm field mapper engine (pdf-lib `form.getTextField().setText()`)
- [x] PDF-3: Map form field definitions to USCIS PDF AcroForm field names (per-form config) — 7 forms mapped, 141 fields
- [ ] PDF-4: Handle USCIS formatting (MM/DD/YYYY dates, checkboxes, continuation sheets)
- [ ] PDF-5: Remove "DRAFT" watermark, produce filing-ready output
- [ ] PDF-6: Add PDF preview in UI
- [ ] PDF-7: Add tests for PDF field mapping correctness
- [ ] PDF-8: Deploy Railway PDF service to production, configure env vars
- [ ] PDF-9: Add field maps for 4 remaining forms (I-129, I-539, I-20, DS-160)

### WS-AI-MAPPING: Expand AI Autofill Coverage (HIGH)
**Status:** Not started
**Assigned Agent:** Unassigned (api-db)
**Priority:** HIGH — only 7-8 fields per form have AI mappings (~85% manual entry)
**Depends on:** WS-FORMS (COMPLETE)
**Details:** See LAUNCH_TRACKER.md → Blocker 3
**Tasks:**
- [ ] Extract address history from utility bills / lease agreements
- [ ] Extract employment history from tax returns / W-2s
- [ ] Extract family relationships from birth/marriage certificates
- [ ] Extract immigration history from I-94, visa stamps
- [ ] Extract education from transcripts / diplomas
- [ ] Update `src/lib/ai/form-autofill.ts` field mappings for all forms

### WS-INFRA: Infrastructure Setup (USER ACTION)
**Status:** Not started
**Assigned Agent:** User / lead
**Priority:** CRITICAL — zero production services configured
**Details:** See LAUNCH_TRACKER.md → Blocker 5
**Notes:**
- Cron handler POST→GET bug fixed (2026-02-16)
- PDF_SERVICE_URL and PDF_SERVICE_SECRET added to env templates
- Still needs all production services configured
**Tasks:**
- [ ] Supabase production instance + push 37 migrations
- [ ] Generate ENCRYPTION_KEY (`openssl rand -hex 32`) and CRON_SECRET (`openssl rand -hex 16`)
- [ ] Configure virus scanner (ClamAV or VirusTotal)
- [ ] Set AI API keys (OpenAI + Anthropic) with billing
- [ ] Set NEXT_PUBLIC_APP_URL to production domain
- [ ] Configure Upstash Redis for rate limiting
- [ ] Configure Resend for email + DNS verification
- [ ] Configure Sentry for error tracking
- [ ] Configure Stripe (if monetizing)
- [ ] Deploy to Vercel
- [ ] Set PDF_SERVICE_URL and PDF_SERVICE_SECRET for Railway PDF service

---

## Non-Blocking Work Streams

### WS-TESTS-P1: Security-Critical API Route Tests (HIGH PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned (test-writer)
**Tasks:**
- [ ] 2FA route tests (5 endpoints: setup, verify, status, backup-codes, disable)
- [ ] Admin route tests (5 endpoints: stats, users, user detail, suspend, unsuspend)
- [ ] Billing route tests (7 endpoints: checkout, portal, cancel, resume, subscription, quota, webhooks)

### WS-TESTS-P2: Feature API Route Tests (MEDIUM PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned (test-writer)
**Tasks:**
- [ ] Chat route tests (2 endpoints)
- [ ] Notification route tests (5 endpoints)
- [ ] Cron, health, profile, task, document-request route tests

### WS-TESTS-P3: Frontend Tests (LOW PRIORITY)
**Status:** Not started
**Assigned Agent:** Unassigned (test-writer)
**Tasks:**
- [ ] Component unit tests (target top 20 critical components)
- [ ] Hook tests (target top 10 custom hooks)

### WS-REMAINING: Non-Blocking Improvements
**Tasks:**
- [ ] Include documents/AI conversations in GDPR data export
- [ ] Fix ESLint warnings
- [ ] Rate-limit consistency: migrate ~38 post-auth endpoints from IP to user.id

---

## Completed Work Streams (Reference)

### WS-FORMS: Missing Form Definitions (COMPLETE)
- [x] I-129 definition + autofill prompt + tests (HIGH — H-1B/L-1/O-1)
- [x] I-539 definition + autofill prompt + tests (MEDIUM)
- [x] I-20 definition + autofill prompt + tests (MEDIUM)
- [x] DS-160 definition + autofill prompt + tests (LOW)
- [x] G-1145 definition + autofill prompt + tests (LOW)

> All 11/11 form types now have complete definitions with fields, sections, AI mappings, prompts, and tests.

### WS-DOC-TYPES: Missing Document Extraction Prompts (COMPLETE)
- [x] i94 extraction prompt (HIGH — entry/exit records)
- [x] w2 extraction prompt (HIGH — employment/income)
- [x] pay_stub extraction prompt (MEDIUM)
- [x] diploma extraction prompt (MEDIUM — for I-140)
- [x] transcript extraction prompt (MEDIUM — for I-140)
- [x] recommendation_letter extraction prompt (LOW)
- [x] photo validation prompt (LOW)

> 16/18 document types now have extraction prompts (was 9). All 7 missing types added: I-94, W-2, pay stub, diploma, transcript, recommendation letter, photo.

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
npm run test:run     # Run tests (2,182+ passing)
npm run lint         # Check lint issues

# Build requires this env var if Redis not configured:
ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build
```
