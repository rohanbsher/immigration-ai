# MVP Launch Design: Immigration AI

**Date:** 2026-02-17
**Goal:** Get Immigration AI in front of real immigration attorneys as a working MVP
**Approach:** Service-first, then polish (Approach A)

---

## Context

### What Exists
- 71 Next.js routes, 90+ API endpoints, 52 DB migrations
- Clean build (zero TS errors)
- Full auth flow: email/password, OAuth (Google + Microsoft), 2FA with TOTP, idle timeout, CSRF
- Real Supabase data everywhere (no mocks)
- AI pipeline: GPT-4o vision for document OCR, Claude Sonnet for form autofill/chat/search
- Production security: RLS, RBAC (4 layers), rate limiting, PII filtering, audit logging, encryption at rest
- Comprehensive UI: skeletons, empty states, error boundaries, animated counters, motion effects
- CI/CD: CodeQL, TruffleHog, Vitest (77 files), Playwright E2E (16 specs)
- Design system: Tailwind v4 + shadcn/ui, OKLCH color tokens, Geist font, dark mode support

### What's Missing for Production
1. External services not wired (Stripe, Resend, Sentry, Upstash Redis)
2. 16 uncommitted files with active security work
3. Small backend gaps (task comments API, invoices API, AI consent GET, admin MRR)
4. In-memory rate limiting (needs Redis for multi-instance)
5. UI is clean but generic (needs distinctive visual identity)
6. No staging environment on Vercel

### Services Available
- Stripe (billing) - account ready
- Resend (email) - account ready
- Sentry (error tracking) - account ready
- Upstash Redis (rate limiting) - account ready

---

## Phase Structure

```
Phase 1: Commit & Consolidate          (~1 session)
Phase 2: Wire External Services        (~4 sessions, one per service)
Phase 3: Fix Backend Gaps              (~1 session)
Phase 4: Full Visual Redesign          (~6 sessions, one per page group)
Phase 5: E2E Verification & Deploy     (~1 session)
```

**Tools per phase:**
- Brainstorming skill: design decisions before each phase
- Ralph Loop: iterative implementation within each phase
- Frontend Design skill: visual direction for Phase 4
- /grill: staff engineer review after each phase
- /verify: verification before commits

---

## Phase 1: Commit & Consolidate

### Objective
Land the 16 uncommitted files representing active security and hardening work.

### Files to Commit

| Group | Files | Purpose |
|-------|-------|---------|
| Security | `src/lib/ai/pii-filter.ts` | Redacts SSN, passport numbers before AI calls |
| Security | `supabase/migrations/051_audit_log_append_only.sql` | USCIS-compliant append-only audit log |
| Security | `supabase/migrations/052_encrypt_form_sensitive_fields.sql` | AES-256-GCM encryption for forms |
| Backend | `src/lib/db/clients.ts`, `src/lib/db/forms.ts` | Query optimization + encryption support |
| Backend | `src/app/api/cases/[id]/documents/route.ts` | API hardening |
| Backend | `src/app/api/cases/[id]/messages/route.ts` | API hardening |
| Backend | `src/app/api/cases/[id]/route.ts` | API hardening |
| Backend | `src/lib/ai/anthropic.ts`, `src/lib/ai/chat/tools.ts` | PII filter integration |
| Frontend | `src/components/chat/chat-button.tsx` | Minor fix |
| Frontend | `src/components/consent/cookie-consent-banner.tsx` | Minor fix |
| Frontend | `src/components/settings/gdpr-data-management.tsx` | Minor fix |
| Frontend | `src/app/globals.css` | CSS additions |
| Tests | `src/hooks/use-consent.test.ts`, `src/lib/utils.test.ts`, `src/lib/db/index.test.ts` | Test updates |
| Tests | `src/components/chat/chat-button.test.tsx` | New test |
| Infra | `supabase/config.toml`, `supabase/seed.sql`, `supabase/tests/` | Local dev + RLS tests |

### Ralph Loop Prompt
```
Review all uncommitted changes in this repository. Run `npm run build` and
`npm run test:run`. Fix any failures. Ensure all changes are coherent and
don't introduce regressions. Commit in logical groups (security, backend,
frontend, tests, infra). Output <promise>CONSOLIDATED</promise> when build
passes, tests pass, and all changes are committed.
```

### Success Criteria
- Clean build (`npm run build` passes)
- All tests pass (`npm run test:run`)
- Changes committed in logical groups with conventional commit messages

---

## Phase 2: Wire External Services

### 2a. Upstash Redis (Rate Limiting)

**What:** Replace in-memory rate limiting with distributed Redis.

**Steps:**
1. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`
2. Verify `src/lib/rate-limit/index.ts` detects Redis and switches from in-memory
3. Test: hit a rate-limited endpoint rapidly, confirm throttling works
4. Set same vars on Vercel production environment

**Ralph Loop Prompt:**
```
Wire up Upstash Redis for distributed rate limiting. The env vars
UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set in .env.local.
Verify that src/lib/rate-limit/index.ts switches from in-memory to Redis.
Test by hitting /api/auth/login rapidly and confirming rate limit headers
appear. Run build + tests. Output <promise>REDIS COMPLETE</promise> when
rate limiting works with Redis.
```

### 2b. Sentry (Error Tracking)

**What:** Activate error monitoring across the app.

**Steps:**
1. Set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` in env
2. Verify `next.config.ts` Sentry integration activates
3. Test: trigger a deliberate error, confirm it appears in Sentry

**Ralph Loop Prompt:**
```
Wire up Sentry error tracking. The env vars SENTRY_DSN,
NEXT_PUBLIC_SENTRY_DSN, and SENTRY_AUTH_TOKEN are set in .env.local.
Verify the Sentry integration in next.config.ts activates. Check that
src/lib/sentry/ utilities work. Run build + tests. Output
<promise>SENTRY COMPLETE</promise> when error tracking is active.
```

### 2c. Resend (Transactional Email)

**What:** Enable email notifications for key events.

**Steps:**
1. Set `RESEND_API_KEY` in env
2. Verify email templates in `src/lib/email/` render correctly
3. Test: register a user, verify welcome email arrives
4. Test: trigger deadline reminder cron, verify email sends

**Ralph Loop Prompt:**
```
Wire up Resend for transactional emails. RESEND_API_KEY is set in
.env.local. Verify the email client in src/lib/email/client.ts connects.
Check that welcome emails send on registration. Verify deadline reminder
emails work via the cron endpoint. Run build + tests. Output
<promise>RESEND COMPLETE</promise> when emails send successfully.
```

### 2d. Stripe (Billing)

**What:** Enable the full billing lifecycle.

**Steps:**
1. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and price IDs in env
2. Create Stripe products/prices matching Free/Pro/Enterprise tiers
3. Verify checkout creates a real subscription
4. Verify webhook handler processes events correctly
5. Fix admin MRR calculation (currently hardcoded to 0 in `/api/admin/stats`)
6. Test: full lifecycle — checkout → portal → cancel → resume

**Ralph Loop Prompt:**
```
Wire up Stripe billing end-to-end. All Stripe env vars are set in
.env.local. Create Stripe products and prices matching the plan tiers
in src/lib/billing/limits.ts (Free/Pro/Enterprise). Verify checkout
flow creates a real subscription. Fix the hardcoded mrr: 0 in
/api/admin/stats/route.ts to calculate real MRR from active
subscriptions. Test cancel and resume flows. Run build + tests.
Output <promise>STRIPE COMPLETE</promise> when all billing operations
work end-to-end.
```

---

## Phase 3: Fix Backend Gaps

### Gaps to Fix

| # | Gap | Fix | Files |
|---|-----|-----|-------|
| 1 | No task comments API | Create `/api/tasks/[id]/comments` GET+POST | New route file |
| 2 | No invoices API | Create `/api/billing/invoices` GET | New route file |
| 3 | No AI consent GET | Add GET handler to `/api/profile/ai-consent` | Modify existing |
| 4 | Admin "Activity feed" placeholder | Remove or implement | `admin/dashboard/page.tsx` |

### Ralph Loop Prompt
```
Fix backend API gaps:
(1) Create GET+POST /api/tasks/[id]/comments route using existing
    TasksService.getComments and TasksService.addComment methods
(2) Create GET /api/billing/invoices route using existing
    SubscriptionsService.getUserInvoices method
(3) Add GET handler to /api/profile/ai-consent/route.ts to check
    consent status (currently only POST grant and DELETE revoke exist)
(4) Remove the "Activity feed coming soon..." placeholder from
    admin/dashboard/page.tsx

Follow existing API patterns (use withAuth/withAttorneyAuth,
successResponse/errorResponse, rate limiting). Run build + tests.
Output <promise>GAPS FIXED</promise> when all routes work and tests pass.
```

---

## Phase 4: Full Visual Redesign

### Design Approach
Use the Frontend Design skill for each page group. The aesthetic should feel:
- **Premium and trustworthy** — immigration law requires authority
- **Distinctive** — not generic SaaS. Memorable.
- **Information-rich but elegant** — attorneys work with dense data

### Page Groups (in order)

#### Group 1: Landing Page (`/`)
- Hero section, features grid, how-it-works, testimonials, pricing, footer
- First impression — must convey trust and capability
- Replace placeholder testimonials with realistic attorney profiles

#### Group 2: Auth Pages (`/login`, `/register`, `/forgot-password`, `/reset-password`)
- Branded, confident, minimal
- Maintain inline error banners (not toast)
- OAuth buttons (Google + Microsoft)

#### Group 3: Dashboard Shell (sidebar, header, command palette)
- The daily workspace — used 8+ hours/day
- Sidebar: collapsible, RBAC-filtered, keyboard shortcut hints
- Header: search, notifications, user menu
- Must feel efficient and refined

#### Group 4: Dashboard Home + Analytics
- KPI cards, charts (Recharts), deadline widget
- Data-dense but not cluttered
- Animated counters, progress rings

#### Group 5: Cases + Case Detail
- Core workflow — most-used pages
- Card/table views, filters, pagination, bulk actions
- 6-tab detail: Overview, Documents, Forms, Messages, Tasks, Activity
- Status badges, document completeness panel, AI recommendations

#### Group 6: Everything Else
- Documents, Forms, Tasks, Clients, Billing, Settings, Firm, Notifications, Admin
- Apply the design language established in Groups 1-5
- Consistency is key

### Process per Group
```
1. Invoke Frontend Design skill with page context
2. Design thinking: purpose, audience, tone, differentiation
3. Implement the redesign (full working code)
4. Ralph Loop iterates until polished
5. /grill to review as staff engineer
6. Commit
```

---

## Phase 5: E2E Verification & Production Deploy

### Verification Checklist
1. Full unit test suite passes (`npm run test:run`)
2. Build clean (`npm run build`)
3. Typecheck clean (`npx tsc --noEmit`)
4. Lint clean (`npm run lint`)
5. Manual walkthrough of core flows:
   - Register → Login → Create case → Upload document → AI analysis
   - Form autofill → PDF generation → Attorney review
   - Billing checkout → Subscription management
   - Firm creation → Team member invite
   - Settings: profile update, 2FA setup, notification preferences
6. External services responding:
   - Stripe webhooks processing
   - Sentry receiving events
   - Resend delivering emails
   - Redis rate limiting active
7. All env vars set on Vercel production
8. Deploy to production
9. Post-deploy: `/api/health` returns healthy
10. Post-deploy: spot-check 3 critical flows in production

### Ralph Loop Prompt
```
Run the full verification suite:
- npm run test:run (all tests must pass)
- npm run build (clean build)
- npx tsc --noEmit (zero type errors)
- npm run lint (no lint errors)

Report any failures with details. If all pass, output
<promise>VERIFIED</promise>.
```

### Deployment Steps
1. Ensure all env vars are set in Vercel dashboard
2. Push to main branch (triggers Vercel deployment)
3. Wait for deployment to complete
4. Run `/api/health` against production URL
5. Manual smoke test of login + case creation + billing

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Stripe webhook URL not configured | Set webhook endpoint in Stripe dashboard pointing to production URL |
| Virus scanner not configured | Accept risk for MVP — add ClamAV/VirusTotal post-launch |
| PDF service not deployed | Falls back to summary PDFs — acceptable for MVP |
| No staging environment | Use Vercel Preview Deployments on PRs as a proxy |
| Rate limiting in-memory pre-Redis | Phase 2a addresses this first |
| Design changes break existing tests | Ralph Loop includes test verification in every iteration |

---

## Success Definition

The MVP is launched when:
1. A real immigration attorney can register, create a case, upload documents, get AI analysis, autofill forms, and manage their practice
2. Billing works end-to-end (checkout, subscription, portal, cancel/resume)
3. Email notifications arrive for key events
4. Errors are tracked in Sentry
5. Rate limiting protects against abuse
6. The UI feels premium and distinctive — not generic
7. All tests pass and build is clean
