# Production Launch Tracker

> Last updated: 2026-02-16
> Status: **PARTIALLY LAUNCH-READY** -- MVP (case management) viable; AI-assisted filing has remaining gaps
> Target: Full attorney workflow -- case intake to USCIS-ready PDF filing

---

## Launch Readiness Score

| Area | Score | Blocking? |
|------|-------|-----------|
| Platform (auth, CRUD, billing, teams) | 92/100 | No |
| AI Document Analysis | 95/100 | No |
| AI Form Autofill | 45/100 | **Yes** |
| PDF Generation (USCIS Filing) | 60/100 | **Partially** |
| Form Coverage | 100/100 | No -- RESOLVED |
| Infrastructure Config | 0/100 | **Yes -- nothing deployed** |
| Test Coverage | 90/100 | No |

---

## BLOCKER 1: PDF Generation (PARTIALLY RESOLVED)

**Current state:** XFA filler engine exists (`src/lib/pdf/xfa-filler.ts`) backed by a Railway-hosted PDF microservice using pikepdf for XFA dataset injection. AcroForm filler (`src/lib/pdf/acroform-filler.ts`) provides shared field mapping types and formatters. 7 forms have USCIS AcroForm field mappings with **141 total field mappings** across those forms. 4 forms (I-129, I-539, I-20, DS-160) lack XFA field maps and fall back to DRAFT summary PDFs.

**Score: 60/100** (up from 15)

### Files involved
- `src/lib/pdf/xfa-filler.ts` -- XFA PDF filler (calls Railway microservice)
- `src/lib/pdf/acroform-filler.ts` -- Shared field mapping types, formatters, utilities
- `src/lib/pdf/index.ts` -- Main PDF generator (summary/draft fallback)
- `src/lib/pdf/templates/index.ts` -- Legacy field position mappings
- `src/lib/pdf/uscis-fields/index.ts` -- Barrel export for AcroForm field maps
- `src/lib/pdf/uscis-fields/{form}.ts` -- Per-form field mappings (7 forms)

### AcroForm field coverage by form

| Form | AcroForm Mappings | Total Form Fields | Coverage | Status |
|------|-------------------|-------------------|----------|--------|
| I-130 | 28 | ~75 | 37% | XFA-ready |
| I-485 | 26 | ~94 | 28% | XFA-ready |
| I-765 | 19 | ~62 | 31% | XFA-ready |
| I-131 | 17 | ~45 | 38% | XFA-ready |
| N-400 | 21 | ~119 | 18% | XFA-ready |
| I-140 | 25 | ~49 | 51% | XFA-ready |
| G-1145 | 5 | ~8 | 63% | XFA-ready |
| I-129 | 0 | ~85 | 0% | DRAFT fallback |
| I-539 | 0 | ~40 | 0% | DRAFT fallback |
| I-20 | 0 | ~30 | 0% | DRAFT fallback |
| DS-160 | 0 | ~70 | 0% | DRAFT fallback |

### Remaining work

| Task | Description | Effort |
|------|-------------|--------|
| **PDF-1** | Add XFA field maps for I-129 | Medium |
| **PDF-2** | Add XFA field maps for I-539 | Small |
| **PDF-3** | Add XFA field maps for I-20 | Small |
| **PDF-4** | Add XFA field maps for DS-160 | Medium |
| **PDF-5** | Add PDF preview in UI (show filled form before download) | Medium |
| **PDF-6** | Increase field mapping depth for existing 7 forms (many sub-30%) | Large |

---

## BLOCKER 2: Form Definition Coverage -- RESOLVED

**Score: 100/100** (up from 55)

**Current state:** All 11/11 USCIS form types have complete definition files with fields, sections, AI field key mappings, autofill prompts, and tests.

### All forms implemented (11/11)

| Form | File | AI Field Keys | Sections | Autofill Prompt | Test File | AcroForm Map |
|------|------|---------------|----------|-----------------|-----------|--------------|
| I-130 | `i-130.ts` | 13 | Yes | Yes | inherited | Yes (28) |
| I-485 | `i-485.ts` | 7 | Yes | Yes | inherited | Yes (26) |
| I-765 | `i-765.ts` | 6 | Yes | Yes | inherited | Yes (19) |
| I-131 | `i-131.ts` | 6 | Yes | Yes | inherited | Yes (17) |
| I-140 | `i-140.ts` | 11 | Yes | Yes | Yes | Yes (25) |
| N-400 | `n-400.ts` | 5 | Yes | Yes | inherited | Yes (21) |
| I-129 | `i-129.ts` | 11 | Yes | Yes | Yes | No |
| I-539 | `i-539.ts` | 8 | Yes | Yes | Yes | No |
| I-20 | `i-20.ts` | 6 | Yes | Yes | Yes | No |
| DS-160 | `ds-160.ts` | 7 | Yes | Yes | Yes | No |
| G-1145 | `g-1145.ts` | 2 | Yes | Yes | Yes | Yes (5) |

---

## BLOCKER 3: AI Autofill Coverage (HIGH)

**Score: 45/100** (unchanged)

**Current state:** 82 total `aiFieldKey` mappings across all 11 forms (10-22 extracted field keys per form, 156 total when counting prompt-level mappings across 11 forms). Coverage relative to total form fields remains 10-25%, meaning ~75-90% of form fields still require manual attorney entry.

### AI autofill mapping by form

| Form | AI-Mapped Fields | Total Fields | Coverage | Key Gaps |
|------|-----------------|--------------|----------|----------|
| I-130 | 13 | ~75 | 17% | Relationship details, address history, employment |
| I-485 | 7 | ~94 | 7% | Immigration history, address (5yr), employment (5yr), family |
| I-765 | 6 | ~62 | 10% | Eligibility category, previous EAD info |
| I-131 | 6 | ~45 | 13% | Travel plans, previous travel docs |
| I-140 | 11 | ~49 | 22% | Education, prevailing wage, labor cert |
| N-400 | 5 | ~119 | 4% | Residency (5yr), employment (5yr), travel, marital, children |
| I-129 | 11 | ~85 | 13% | Beneficiary qualifications, labor condition details |
| I-539 | 8 | ~40 | 20% | Current status details, extension justification |
| I-20 | 6 | ~30 | 20% | Program details, financial support |
| DS-160 | 7 | ~70 | 10% | Travel history, security questions, contact details |
| G-1145 | 2 | ~8 | 25% | Minimal -- mostly applicant name |

### What would meaningfully improve coverage

| Enhancement | Impact | Effort |
|-------------|--------|--------|
| Extract address history from utility bills / lease agreements | +10-15 fields across I-485, I-130, N-400 | Medium |
| Extract employment history from tax returns / W-2s | +8-12 fields across I-485, N-400 | Medium |
| Extract family relationships from birth/marriage certificates | +5-8 fields across I-130, I-485 | Small |
| Extract immigration history from I-94, visa stamps | +6-10 fields across I-485, I-765 | Medium |
| Extract education from transcripts / diplomas | +4-6 fields for I-140 | Small |

---

## BLOCKER 4: Document Type Recognition -- RESOLVED

**Score: 95/100** (up from ~50)

**Current state:** 16 of 18 document types have dedicated extraction prompts in `src/lib/ai/prompts.ts`. Only `visa` and `other` lack specific prompts (both fall back to `GENERIC_DOCUMENT_EXTRACTION_PROMPT`). All 7 previously missing types have been added.

### Supported document types (16/18)

| Type | Extraction Prompt | Status |
|------|------------------|--------|
| passport | Yes | Original |
| birth_certificate | Yes | Original |
| marriage_certificate | Yes | Original |
| employment_letter | Yes | Original |
| bank_statement | Yes | Original |
| tax_return | Yes | Original |
| medical_exam | Yes | Original |
| police_clearance | Yes | Original |
| divorce_certificate | Yes | Original |
| i94 | Yes | **NEW** |
| w2 | Yes | **NEW** |
| pay_stub | Yes | **NEW** |
| diploma | Yes | **NEW** |
| transcript | Yes | **NEW** |
| recommendation_letter | Yes | **NEW** |
| photo | Yes (validation prompt) | **NEW** |

### Remaining gaps (2 -- low priority)

| Type | Status | Notes |
|------|--------|-------|
| visa | Falls back to generic prompt | Could add visa-stamp-specific extraction |
| other | Falls back to generic prompt | Catch-all by design |

---

## BLOCKER 5: Infrastructure Configuration (REQUIRED)

**Score: 0/100** (unchanged -- nothing deployed)

**Current state:** Zero production services configured. All env vars are placeholder/dev values. Cron handler bug was fixed (changed from POST to GET in `src/app/api/cron/deadline-alerts/route.ts`).

### Phase 1 -- App won't function without these

| Service | Env Var(s) | Status | Action |
|---------|-----------|--------|--------|
| Supabase (production) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Not set | Create project, push 37 migrations |
| AI keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Dev only | Set production keys with billing |
| Encryption | `ENCRYPTION_KEY` | Not set | `openssl rand -hex 32` |
| Cron auth | `CRON_SECRET` | Not set | `openssl rand -hex 16` |
| Virus scanner | `VIRUS_SCANNER_PROVIDER`, `VIRUSTOTAL_API_KEY` | Not set | ClamAV or VirusTotal |
| App URL | `NEXT_PUBLIC_APP_URL` | localhost | Set production domain |
| PDF service | `PDF_SERVICE_URL` | Not set | Deploy Railway PDF microservice |

### Phase 2 -- Strongly recommended before launch

| Service | Env Var(s) | Status | Action |
|---------|-----------|--------|--------|
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Not set | Rate limiting fails closed without |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Not set | Transactional emails won't send |
| Error tracking | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Not set | No visibility into production errors |

### Phase 3 -- Optional

| Service | Env Var(s) | Status | Action |
|---------|-----------|--------|--------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Not set | Only if monetizing |
| Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Not set | Product analytics |

---

## NON-BLOCKING: What's Already Solid

These areas are production-ready and don't need work before launch:

- **Authentication:** Supabase Auth + TOTP 2FA + NIST backup codes + idle timeout + password policy
- **Authorization:** RBAC (attorney/client/admin) + RLS on all tables
- **Case Management:** Full CRUD, 16 visa types, 10 status stages, client assignment
- **Document Vault:** Upload, validation (magic bytes + virus scan), signed URLs, access logging
- **Document Analysis:** 16/18 document types with dedicated AI extraction prompts
- **Form Definitions:** All 11/11 USCIS forms fully defined with fields, sections, AI mappings
- **Billing:** Stripe integration, Free/Pro/Enterprise plans, quota enforcement, webhook idempotency
- **Multi-tenancy:** Firm management, team invitations, role assignments
- **AI Chat:** SSE streaming, tool use, conversation history, consent management
- **Security:** CSP, HSTS, CSRF, SSRF prevention, AES-256-GCM encryption, audit logging
- **Testing:** 2,182+ unit tests + 86 E2E tests, 86%+ coverage, CI/CD pipeline
- **Code Quality:** Structured logging, error boundaries, TypeScript strict mode
- **PDF Engine:** XFA filler with Railway microservice for 7 forms, 141 AcroForm field mappings

---

## Recommended Launch Sequence

### Phase A: MVP Launch (Case Management + Document Collection)
**Scope:** Attorneys can manage cases, upload/organize documents, use AI chat and document analysis. No automated filing.
**Remaining work:** Infrastructure config only (Blocker 5).

### Phase B: AI-Assisted Filing (Full Product)
**Scope:** End-to-end workflow -- case intake, document extraction, form autofill, USCIS-ready PDF output.
**Remaining work:** Blockers 1 (partial), 3, and 5.

### Suggested agent assignment for Phase B

| Work Stream | Owner | Dependencies | Files |
|-------------|-------|-------------|-------|
| **WS-PDF-EXPAND** | api-db agent | Add XFA maps for 4 remaining forms | `src/lib/pdf/uscis-fields/` |
| **WS-PDF-DEPTH** | api-db agent | Increase field mapping coverage for existing 7 forms | `src/lib/pdf/uscis-fields/` |
| **WS-AI-MAPPING** | api-db agent | Expand AI autofill extraction to cover more fields | `src/lib/ai/form-autofill.ts`, `src/lib/ai/prompts.ts` |
| **WS-INFRA** | lead / user | Independent | `.env.production`, Supabase dashboard, Railway |
| **WS-TESTS** | test-writer agent | After other streams | `**/*.test.ts` |

---

## Current Stats

```
Tests:      2,182+ passed (unit) + 86 (E2E) | 0 failures
Build:      Passes (no TypeScript errors)
Coverage:   86%+ statements
Migrations: 37 SQL files (001-044, with gaps)
API Routes: 50+ endpoints across 18 groups
Forms:      11/11 defined | 7/11 XFA-ready | 141 AcroForm field mappings
Doc Types:  16/18 with extraction prompts
```
