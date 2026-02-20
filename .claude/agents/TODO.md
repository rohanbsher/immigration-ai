# Immigration AI - Agent Task List

> Last updated: 2026-02-19 (CI fully green, runtime hardening session)

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

## Current State (2026-02-19 23:30)

```
Tests:  2,532 passed | 4 skipped | 0 failures (93 test files)
Build:  Passes (tsc clean, Vercel production Ready)
Coverage: 86%+ statements, 70.42% branches
Migrations: 62 SQL files (all applied to production — DB audit PASSED)
Production: Deployed to https://immigration-ai-topaz.vercel.app
Worker: Deployed to https://immigration-ai-production.up.railway.app (E2E verified)
PDF Service: Deployed to https://pdf-service-production-abc5.up.railway.app (9 templates)
Branch: main (all deployment steps complete)
CI: ALL 6 JOBS GREEN
PDF Fields: 697 AcroForm field mappings (9 forms — added I-129 + I-539)
AI Mappings: 50+ field mappings across 6 forms
Citations: Two-pass architecture complete (AI_CITATIONS_ENABLED feature flag)
DB Audit: 41 tables, 141 constraints, 42 triggers, all RLS enabled, 0 orphaned rows
```

> **Full launch tracker: `.claude/LAUNCH_TRACKER.md`**

---

## NEXT SESSION: Implementation Plan

Priority order for the next agent session. User is handling custom domain purchase in parallel.

### Sprint 1: PDF Polish (estimate: ~1 session)
These are the last 3 tasks blocking "filing-ready" PDF output:

1. **PDF-4: USCIS Formatting** — Handle MM/DD/YYYY dates, checkbox fields, continuation sheets
   - Files: `src/lib/pdf/index.ts`, `src/lib/pdf/uscis-fields/*.ts`
   - Pattern: Look at existing field maps, add date formatters and checkbox handling

2. **PDF-5: Remove DRAFT Watermark** — Make PDFs filing-ready
   - Files: `services/pdf-service/main.py` (pikepdf), `src/lib/pdf/index.ts`
   - Note: DRAFT watermark is currently added by the pdf-service; need to make it conditional or remove

3. **PDF-9c: I-20 + DS-160 Field Maps** — Add remaining 2 form field maps
   - Files: `src/lib/pdf/uscis-fields/i-20.ts` (new), `src/lib/pdf/uscis-fields/ds-160.ts` (new)
   - Pattern: Follow existing i-129.ts / i-539.ts as templates

### Sprint 2: Test Coverage (estimate: ~2 sessions, parallelizable)

4. **WS-TESTS-P1: Security-Critical Route Tests** (HIGH)
   - 2FA routes: setup, verify, status, backup-codes, disable (5 endpoints)
   - Admin routes: stats, users, user detail, suspend, unsuspend (5 endpoints)
   - Billing routes: checkout, portal, cancel, resume, subscription, quota, webhooks (7 endpoints)
   - Files: `src/app/api/2fa/**/*.test.ts`, `src/app/api/admin/**/*.test.ts`, `src/app/api/billing/**/*.test.ts`
   - Use existing test patterns from `src/app/api/cases/cases.test.ts`

5. **WS-TESTS-P2: Feature Route Tests** (MEDIUM)
   - Chat, Notification, Cron, Health, Profile, Task, Document-request routes
   - Files: `src/app/api/chat/*.test.ts`, etc.

6. **WS-TESTS-P3: Frontend Tests** (LOW)
   - Top 20 critical components + top 10 hooks
   - Biggest coverage gap: 94 components at ~1%, 25/27 hooks untested

### Sprint 3: Hardening (can be done alongside tests)

7. **Rate-limit user.id migration** — Change ~38 post-auth endpoints from IP-based to user.id-based rate limiting
   - Files: All API routes under `src/app/api/`
   - Pattern: Change `rateLimit({ identifier: ip })` to `rateLimit({ identifier: user.id })`

8. **GDPR data export expansion** — Include documents and AI conversations
   - Files: `src/lib/db/` (get_user_export_data RPC)

9. **Enable AI_CITATIONS_ENABLED=true** on Vercel (just a flag flip via `vercel env add`)

### User is handling:
- Custom domain purchase → update NEXT_PUBLIC_APP_URL + SITE_URL
- Resend DNS verification (after custom domain)
- Stripe live mode activation (when ready for billing)

---

## Launch-Blocking Work Streams

### WS-PDF: USCIS PDF Generation (COMPLETE — 2026-02-19)
**Status:** Core complete — deployed to Railway, 605 field mappings, 7 templates
**Assigned Agent:** lead
**Priority:** DONE (core), remaining tasks are polish
**Progress:** Railway PDF service live at `https://pdf-service-production-abc5.up.railway.app`, 605 AcroForm fields mapped (4.3x increase from 141), Vercel env vars set
**Tasks:**
- [x] PDF-1: Obtain official USCIS fillable PDF templates (I-130, I-485, I-765, I-131, N-400, I-140, G-1145)
- [x] PDF-2: Build AcroForm field mapper engine (pdf-lib `form.getTextField().setText()`)
- [x] PDF-3: Map form field definitions to USCIS PDF AcroForm field names — 7 forms, 605 fields
- [x] PDF-7: Add tests for PDF field mapping correctness (196 tests across 4 test files)
- [x] PDF-8: Deploy Railway PDF service to production, configure env vars
- [x] PDF-6: Add PDF download button + preview iframe in form detail UI
- [x] PDF-9a: Add I-129 AcroForm field map (55 fields — petitioner, classification, beneficiary, job, signature)
- [x] PDF-9b: Add I-539 AcroForm field map (37 fields — applicant, application type, processing, signature)
- [ ] PDF-4: Handle USCIS formatting (MM/DD/YYYY dates, checkboxes, continuation sheets)
- [ ] PDF-5: Remove "DRAFT" watermark, produce filing-ready output
- [ ] PDF-9c: Add field maps for 2 remaining forms (I-20, DS-160)

### WS-AI-MAPPING: Expand AI Autofill Coverage (COMPLETE — 2026-02-19)
**Status:** COMPLETE — 50 new field mappings, history builder, gap analysis, DocumentPrompt UI
**Assigned Agent:** lead
**Priority:** DONE
**Tasks:**
- [x] Extract address history from utility bills / lease agreements
- [x] Extract employment history from tax returns / W-2s
- [x] Extract family relationships from birth/marriage certificates
- [x] Extract immigration history from I-94, visa stamps
- [x] Extract education from transcripts / diplomas
- [x] Update `src/lib/ai/form-autofill.ts` field mappings for all forms (50 new mappings)
- [x] Create history builder module (address/employment/education)
- [x] Add `flattenRepeatingFields()` for XFA PDF generation
- [x] Add smart document gap analysis (`getAutofillGaps()`)
- [x] Build `DocumentPrompt` UI component for missing documents
- [x] Integrate gaps into autofill API response

### WS-BACKEND: Backend Worker Service (COMPLETE — 2026-02-19)
**Status:** ALL 4 PHASES COMPLETE + 3 rounds of staff engineer review fixes
**Assigned Agent:** lead
**Plan:** `docs/BACKEND_INTEGRATION_PLAN.md` (864 lines)
**Branch:** `feat/worker-service` (merged to `main`)
**Architecture:** Hybrid — CRUD stays in Next.js, AI/email/cron moves to BullMQ worker on Railway

#### Phase 1: Foundation (COMPLETE — 2026-02-18)
- [x] P1-1: Install BullMQ + create feature branch
- [x] P1-2: Add `REDIS_URL` + `WORKER_ENABLED` env config + feature flag
- [x] P1-3: Create BullMQ connection, types, queue definitions (`src/lib/jobs/`)
- [x] P1-4: Create worker service scaffold (`services/worker/` — config, health, index)
- [x] P1-5: Create Dockerfile + railway.toml for Railway deployment
- [x] P1-6: Create job status API route (`/api/jobs/[id]/status`)
- [x] P1-7: Create `job_status` database migration (#054)
- [x] P1-8: Create frontend job polling utility (`src/lib/jobs/polling.ts`)
- [x] P1-9: Verify build passes (Next.js + worker both compile clean)

#### Phase 2: Migrate AI Operations (COMPLETE — 2026-02-19)
- [x] P2-1: Migrate document analysis (`POST /api/documents/[id]/analyze`)
- [x] P2-2: Migrate form autofill (`POST /api/forms/[id]/autofill`)
- [x] P2-3: Migrate recommendations (`GET /api/cases/[id]/recommendations`)
- [x] P2-4: Migrate completeness check (`GET /api/cases/[id]/completeness`)
- [x] P2-5: Migrate success score (`GET /api/cases/[id]/success-score`)
- [x] P2-6: Migrate natural search (`GET /api/cases/search`)
- [x] P2-7: Update frontend hooks for async job pattern (`fetchJobAware` + progress)
- [x] P2-8: Expand worker tsconfig to include `src/lib/ai/`, `src/lib/db/`, etc.
- [x] P2-9: DB migration #055 — AI cache columns on `cases` table
- [x] P2-10: Cache-first read before enqueue (3 routes: recommendations, completeness, success-score)
- [x] P2-11: Tests for async flow (fetchJobAware, route async tests, processor tests)

#### Phase 3: Email Queue (COMPLETE — 2026-02-19)
- [x] P3-1: Create email processor (`services/worker/src/processors/email.ts`)
- [x] P3-2: Update `sendEmail()` for async path (pre-render HTML, enqueue)
- [x] P3-3: Add `html` field to `EmailJob` type
- [x] P3-4: Register email worker in `services/worker/src/index.ts`

#### Phase 4: Reliability & Monitoring (COMPLETE — 2026-02-19)
- [x] P4-1: Circuit breaker for AI providers (`src/lib/ai/circuit-breaker.ts`)
- [x] P4-2: Wrap all 5 worker AI calls in circuit breaker
- [x] P4-3: Sentry integration for worker errors
- [x] P4-4: Retry strategies configured per queue type

#### Staff Engineer Review Fixes (3 rounds)
- [x] Round 1 (7 fixes): Auth, typing, error handling, test mocks
- [x] Round 2 (6 fixes): Config validation, worker shutdown, health endpoint
- [x] Round 3 (8 fixes): Stale jobId dedup (`addWithDedup`), quota enforcement, SSRF validation, audit logging, single-queue lookup optimization, sanitizeResult whitelist, migration squash

#### Deployment Steps (COMPLETE — 2026-02-19)
- [x] Deploy worker to Railway (new service, root dir = monorepo root)
- [x] Set Railway env vars (REDIS_URL, Supabase, AI keys, etc.)
- [x] Get `REDIS_URL` from Upstash dashboard (standard Redis endpoint, not REST)
- [x] Apply migrations #054-055 to production Supabase
- [x] Set `WORKER_ENABLED=true` on staging, test all flows
- [x] Set `WORKER_ENABLED=true` on production Vercel

### WS-INFRA: Infrastructure Setup (COMPLETE — 2026-02-18)
**Status:** Complete (core services)
**Assigned Agent:** User / lead
**Priority:** DONE
**Notes:**
- All core production services configured and deployed
- 29 Vercel production env vars set via REST API
- ALLOW_IN_MEMORY_RATE_LIMIT removed (real Redis in production)
- PDF_SERVICE_URL removed from Vercel (empty string caused Zod validation failure)
**Completed Tasks:**
- [x] Supabase production instance (ref: sforzkbeahfkeilynbwk) + push all 46 migrations
- [x] Generate ENCRYPTION_KEY and CRON_SECRET
- [x] Configure VirusTotal for virus scanning
- [x] Set AI API keys (OpenAI + Anthropic) with billing
- [x] Configure Upstash Redis for rate limiting (sharing-buffalo-59262.upstash.io)
- [x] Configure Resend for email
- [x] Configure Sentry for error tracking (org: immigration-ai-ni)
- [x] Configure Stripe in test mode (4 price IDs + webhook)
- [x] Deploy to Vercel (https://immigration-ai-topaz.vercel.app)
- [x] Set all 29 Vercel production environment variables
**Remaining Tasks:**
- [ ] Buy custom domain → update NEXT_PUBLIC_APP_URL + SITE_URL
- [ ] Resend DNS verification (after custom domain)
- [ ] Deploy PDF service → set PDF_SERVICE_URL and PDF_SERVICE_SECRET
- [ ] Activate Stripe live mode (currently test keys)

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
- [x] Fix ESLint warnings (src/ files cleaned up, e2e test warnings remain)
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

### WS-CITATIONS: AI Citations — Phase 4 (COMPLETE — 2026-02-19)
**Status:** COMPLETE — two-pass citation generation with feature flag
**Design:** `docs/plans/2026-02-19-citations-design.md`
**Plan:** `docs/plans/2026-02-19-citations-plan.md`
**Tasks:**
- [x] Update `parseCitationsFromResponse()` for real Anthropic Citations API format (char_location, page_location, content_block_location)
- [x] Add `generateFieldCitations()` — Pass 2 API call with document content blocks + citations enabled
- [x] Wire citations into `autofillForm()` pipeline (feature-flagged behind `AI_CITATIONS_ENABLED`)
- [x] Store per-field citations in `ai_filled_data._metadata.citations`, pass raw_text through
- [x] 30 unit tests for citation parsing, mapping, and generation
- [ ] **Activation:** Set `AI_CITATIONS_ENABLED=true` on Vercel production to enable

---

## Notes for Agents

### Before Starting Work
1. Read `.claude/CONTEXT.md` for current project state
2. Read this TODO.md to find available work
3. Run `ALLOW_IN_MEMORY_RATE_LIMIT=true npm run build && npm run test:run` to verify starting state
4. Claim a work stream before starting

### Recent Session Notes (2026-02-19 19:20)
- CI fully green after fixing build-worker job (root deps installation + zod v3 downgrade)
- Worker `services/worker/package.json` uses zod v3 (not v4) due to openai peer dep
- `AbortSignal.any()` polyfill added in `fetch-with-timeout.ts` for older browsers
- SIGTERM/SIGINT shutdown hooks added to `queues.ts` for clean worker exit
- Branch coverage improved to 70.42%

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test:run     # Run tests (2,289+ passing)
npm run lint         # Check lint issues
```
