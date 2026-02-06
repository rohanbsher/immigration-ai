# Immigration AI - Production Setup Guide

> Generated: 2026-02-06 | Based on comprehensive codebase audit

## Quick Summary

| Category | Count | Status |
|----------|-------|--------|
| External Services | 10 | Integration complete, config needed |
| Environment Variables | 38 total | 6 critical, 7 recommended, 25 optional |
| Pending Migrations | 3 | Ready to run (all safe & idempotent) |
| Estimated Monthly Cost | $25-100 | Depends on usage tier |

---

## Table of Contents

1. [Critical Services (Must Configure)](#1-critical-services)
2. [Recommended Services](#2-recommended-services)
3. [Optional Services](#3-optional-services)
4. [Complete Environment Variable Reference](#4-environment-variable-reference)
5. [Pending Database Migrations](#5-pending-database-migrations)
6. [Production Launch Checklist](#6-production-launch-checklist)
7. [Cost Estimates](#7-cost-estimates)

---

## 1. Critical Services

These MUST be configured for the app to function.

### 1.1 Supabase (Database + Auth + Storage)

**Purpose:** PostgreSQL database, user authentication, document storage
**Packages:** `@supabase/supabase-js` v2.90.1, `@supabase/ssr` v0.8.0

| Variable | Type | Example |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | `eyJhbGciOiJIUzI1NiIs...` |

**Setup:**
1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get URL and keys
3. Run all 35 migrations in SQL Editor (see Section 5)
4. Configure Auth redirect URL to your production domain

**Cost:** Free tier (500MB DB, 1GB storage) | Pro $25/mo (8GB DB, 100GB storage)

---

### 1.2 OpenAI (Document OCR)

**Purpose:** GPT-4 Vision for passport/document image analysis
**Package:** `openai` v4.100.0
**Model:** `gpt-4o` (vision-capable)
**Initialized:** `src/lib/ai/openai.ts` (lazy-loaded)

| Variable | Type | Example |
|----------|------|---------|
| `OPENAI_API_KEY` | Server-only | `sk-proj-...` |

**Setup:**
1. Create account at [platform.openai.com](https://platform.openai.com)
2. Get API key from Dashboard > API Keys
3. Set usage limits in Settings > Limits (recommended: $50/mo cap)

**Config:** 120s timeout, temperature 0.1, JSON response format
**Cost:** ~$0.05 per document analysis | ~$1-50/mo depending on volume

> **Note:** At least one of OpenAI OR Anthropic must be configured. Both are recommended for full functionality.

---

### 1.3 Anthropic / Claude (Form Autofill)

**Purpose:** AI-powered form field mapping, consistency checks, legal reasoning
**Package:** `@anthropic-ai/sdk` v0.72.0
**Model:** `claude-sonnet-4-20250514`
**Initialized:** `src/lib/ai/anthropic.ts` (lazy-loaded)

| Variable | Type | Example |
|----------|------|---------|
| `ANTHROPIC_API_KEY` | Server-only | `sk-ant-api03-...` |

**Setup:**
1. Create account at [console.anthropic.com](https://console.anthropic.com)
2. Get API key from Settings
3. Set usage limits (recommended: $50/mo cap)

**Config:** 120s timeout, tool-use for structured outputs
**Cost:** ~$0.05 per form autofill | ~$1-50/mo depending on volume

---

### 1.4 Security Keys

| Variable | Type | How to Generate | Purpose |
|----------|------|-----------------|---------|
| `ENCRYPTION_KEY` | Server-only | `openssl rand -hex 32` | AES-256-GCM encryption for PII at rest |
| `CRON_SECRET` | Server-only | `openssl rand -hex 16` | Auth for scheduled tasks + health endpoint |

**Critical:** `ENCRYPTION_KEY` must be exactly 64 hex characters (32 bytes). Back it up securely - losing this key means losing access to encrypted PII data.

---

### 1.5 Virus Scanning

**Purpose:** Scan uploaded documents for malware
**Behavior:** File uploads are REJECTED in production without proper scanner configuration

| Variable | Type | Values |
|----------|------|--------|
| `VIRUS_SCANNER_PROVIDER` | Server-only | `clamav` or `virustotal` |
| `CLAMAV_API_URL` | Server-only | `http://your-clamav:3000` (if clamav) |
| `VIRUSTOTAL_API_KEY` | Server-only | API key (if virustotal) |

**Option A - ClamAV (Self-hosted):**
- Deploy [clamav-rest](https://github.com/DP-3T/clamav-rest) or similar REST wrapper
- Cost: $0 (self-hosted) or ~$50-200/mo (managed)

**Option B - VirusTotal (Cloud):**
- Get API key at [virustotal.com](https://www.virustotal.com/gui/my-apikey)
- Cost: Free tier (40 uploads/min) | Paid ~$0.003/file

---

## 2. Recommended Services

Not strictly required but important for production.

### 2.1 Upstash Redis (Rate Limiting)

**Purpose:** Distributed rate limiting across serverless instances
**Packages:** `@upstash/redis` v1.36.1, `@upstash/ratelimit` v2.0.8
**Initialized:** `src/lib/rate-limit/index.ts`

| Variable | Type | Example |
|----------|------|---------|
| `UPSTASH_REDIS_REST_URL` | Server-only | `https://us1-abc.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only | `AXY...` |

**Rate limits enforced:**
- Auth: 5 req/min per IP
- Standard API: 100 req/min per user
- AI endpoints: 10 req/hour per user
- AI chat: 50 req/hour per user

**Critical behavior:**
- Without Redis in production: ALL requests are **rejected** (fail-closed)
- Set `ALLOW_IN_MEMORY_RATE_LIMIT=true` only for builds/development
- In-memory fallback does NOT work across multiple serverless instances

**Setup:**
1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database (choose region closest to your Vercel deployment)
3. Copy REST URL and token

**Cost:** Free tier (10K commands/day) | Pay-as-you-go ~$0.02/mo for small apps

---

### 2.2 Sentry (Error Tracking)

**Purpose:** Error tracking, performance monitoring, session replay
**Package:** `@sentry/nextjs` v10.37.0

| Variable | Type | Purpose |
|----------|------|---------|
| `SENTRY_DSN` | Server-only | Server-side error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Client-side error tracking |
| `SENTRY_ORG` | Build-time | Source map uploads |
| `SENTRY_PROJECT` | Build-time | Source map uploads |
| `SENTRY_AUTH_TOKEN` | Build-time | Source map uploads |

**Privacy:** PII masked in replays, emails partially masked, API keys/SSNs/passports stripped

**Setup:**
1. Create account at [sentry.io](https://sentry.io)
2. Create Next.js project
3. Get DSN from Settings > Client Keys
4. Generate auth token from User Settings > Auth Tokens

**Cost:** Free tier (5K events/mo) | Pro $29/mo (50K events)

---

## 3. Optional Services

### 3.1 Stripe (Billing & Subscriptions)

**Purpose:** Subscription management, payment processing
**Package:** `stripe` v20.2.0
**Feature flag:** Enabled when both `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set

| Variable | Type | Purpose |
|----------|------|---------|
| `STRIPE_SECRET_KEY` | Server-only | API authentication |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Client-side checkout |
| `STRIPE_WEBHOOK_SECRET` | Server-only | Webhook signature verification |
| `STRIPE_PRICE_PRO_MONTHLY` | Server-only | Pro monthly price ID |
| `STRIPE_PRICE_PRO_YEARLY` | Server-only | Pro yearly price ID |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | Server-only | Enterprise monthly price ID |
| `STRIPE_PRICE_ENTERPRISE_YEARLY` | Server-only | Enterprise yearly price ID |

**Webhook URL:** `https://yourdomain.com/api/billing/webhooks`
**Events to subscribe:**
- `checkout.session.completed`
- `customer.subscription.created`, `.updated`, `.deleted`
- `invoice.paid`, `invoice.payment_failed`
- `customer.updated`

**Plan Limits:**
| Plan | Cases | Docs/Case | AI Requests | Storage | Team |
|------|-------|-----------|-------------|---------|------|
| Free | 5 | 10 | 25/mo | 1 GB | 1 |
| Pro | 50 | 50 | 500/mo | 25 GB | 5 |
| Enterprise | Unlimited | Unlimited | Unlimited | 500 GB | Unlimited |

**Setup:**
1. Create account at [stripe.com](https://stripe.com)
2. Create products & prices in Dashboard
3. Configure webhook endpoint
4. Get keys from Dashboard > Developers > API Keys

**Cost:** 2.9% + $0.30 per transaction

---

### 3.2 Resend (Email)

**Purpose:** Transactional emails (welcome, case updates, deadlines, invitations)
**Package:** `resend` v6.8.0 + `@react-email/components` v1.0.6
**Feature flag:** Enabled when `RESEND_API_KEY` is set

| Variable | Type | Example |
|----------|------|---------|
| `RESEND_API_KEY` | Server-only | `re_abc123...` |
| `EMAIL_FROM` | Server-only | `Immigration AI <noreply@yourdomain.com>` |
| `EMAIL_REPLY_TO` | Server-only | `support@yourdomain.com` |

**Email types:** subscription_created, subscription_cancelled, payment_succeeded, payment_failed, welcome, case_update, deadline_alert, invitation

**Setup:**
1. Create account at [resend.com](https://resend.com)
2. Verify sender domain (DNS records required)
3. Get API key from dashboard

**Cost:** Free tier (100 emails/day) | $20/mo (100K emails)

---

### 3.3 PostHog (Analytics)

**Purpose:** Product analytics and user behavior tracking
**Feature flag:** Enabled when `NEXT_PUBLIC_POSTHOG_KEY` is set
**Status:** Config exists but SDK not fully integrated in app code yet

| Variable | Type | Example |
|----------|------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Public | `phc_abc123...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | Public | `https://app.posthog.com` |

**Cost:** Free tier (1M events/mo)

---

### 3.4 Vercel (Deployment)

**Purpose:** Serverless deployment, edge functions, cron jobs
**Auto-set variables:** `VERCEL_URL`, `NODE_ENV`

**Cron job configured:**
- Deadline alerts: `0 6 * * *` (6 AM UTC daily)
- Endpoint: `/api/cron/deadline-alerts`
- Auth: `CRON_SECRET` header

**Setup:**
1. Connect GitHub repo to [vercel.com](https://vercel.com)
2. Set ALL environment variables in Dashboard > Settings > Environment Variables
3. Set production domain + update `NEXT_PUBLIC_APP_URL`

**Cost:** Free (hobby) | $20/mo (Pro)

---

## 4. Environment Variable Reference

### All 38 Variables by Priority

#### Critical (6) - App won't function without these
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_KEY=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 16)
# At least ONE of:
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

#### Recommended (7) - Important for production quality
```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
VIRUS_SCANNER_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=...
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

#### Optional - Billing (7)
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

#### Optional - Email (3)
```bash
RESEND_API_KEY=re_...
EMAIL_FROM=Immigration AI <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
```

#### Optional - Monitoring (3)
```bash
SENTRY_ORG=your-org
SENTRY_PROJECT=immigration-ai
SENTRY_AUTH_TOKEN=sntrys_...
```

#### Optional - Analytics (2)
```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

#### Optional - Other (2)
```bash
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
LOG_LEVEL=info
```

#### Build/Dev Only (2)
```bash
ALLOW_IN_MEMORY_RATE_LIMIT=true  # Only for builds without Redis
DEBUG_TESTS=true                  # Only for verbose test output
```

#### Auto-Set by Platform (3)
```bash
NODE_ENV          # Set by Node.js
VERCEL_URL        # Set by Vercel
npm_package_version  # Set by npm
```

---

## 5. Pending Database Migrations

Three migrations need to be run in Supabase SQL Editor. All are **safe and idempotent**.

### Run Order: 033 → 034 → 035

#### Migration 033: RLS Policies for Lookup Tables
**File:** `supabase/migrations/033_add_rls_policies_checklists_processing.sql`
**What:** Enables RLS on `document_checklists` and `processing_times` tables. Public read, admin-only write.
**Risk:** None (additive only, idempotent)

#### Migration 034: Backfill NULL firm_id
**File:** `supabase/migrations/034_backfill_cases_firm_id.sql`
**What:** Fills in NULL `firm_id` on cases for multi-tenant safety. Conditionally adds NOT NULL constraint.
**Risk:** Low (data update, not destructive, logs warnings for edge cases)
**Note:** Check Supabase logs after running for warnings about orphaned cases.

#### Migration 035: Document Quota RPC
**File:** `supabase/migrations/035_document_quota_rpc.sql`
**What:** Creates `get_max_documents_per_case()` function - replaces N+1 queries with single aggregation.
**Risk:** None (creates new function only, idempotent)

---

## 6. Production Launch Checklist

### Phase 1: Database
- [ ] Create Supabase project
- [ ] Run all migrations (001-035) in SQL Editor
- [ ] Verify RLS policies are enabled on all tables
- [ ] Set up database backups (Supabase Pro plan)

### Phase 2: Critical Config
- [ ] Generate `ENCRYPTION_KEY`: `openssl rand -hex 32`
- [ ] Generate `CRON_SECRET`: `openssl rand -hex 16`
- [ ] Set Supabase URL + keys
- [ ] Set at least one AI API key (OpenAI and/or Anthropic)
- [ ] Configure virus scanner (ClamAV or VirusTotal)

### Phase 3: Infrastructure
- [ ] Set up Upstash Redis for rate limiting
- [ ] Set up Sentry for error tracking
- [ ] Configure Vercel deployment
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Set `NEXT_PUBLIC_SITE_URL` for CSRF validation

### Phase 4: Optional Services
- [ ] Set up Stripe (if using billing)
- [ ] Configure webhook endpoint in Stripe dashboard
- [ ] Create Stripe products and price IDs
- [ ] Set up Resend (if using email)
- [ ] Verify sender domain DNS records

### Phase 5: Deploy & Verify
- [ ] Set all env vars in Vercel dashboard
- [ ] Deploy: `git push` (auto-deploys via Vercel)
- [ ] Verify build passes
- [ ] Test health endpoint: `curl https://yourdomain.com/api/health`
- [ ] Test authenticated health: `curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/health`
- [ ] Verify cron job fires at 6 AM UTC
- [ ] Test login flow end-to-end
- [ ] Test document upload + virus scan
- [ ] Test AI document analysis
- [ ] Test AI form autofill

---

## 7. Cost Estimates

### Minimum Viable (Free Tiers)
| Service | Monthly Cost |
|---------|-------------|
| Supabase (Free) | $0 |
| OpenAI (pay-as-you-go) | ~$5 |
| Anthropic (pay-as-you-go) | ~$5 |
| Upstash Redis (Free) | $0 |
| Sentry (Free) | $0 |
| VirusTotal (Free) | $0 |
| Vercel (Free/Hobby) | $0 |
| **Total** | **~$10/mo** |

### Production (5-20 users)
| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| OpenAI | ~$25 |
| Anthropic | ~$25 |
| Upstash Redis | ~$1 |
| Sentry Pro | $29 |
| Stripe (2.9% + $0.30/txn) | ~$5 |
| Resend | $0 (free tier) |
| Vercel Pro | $20 |
| VirusTotal or ClamAV | ~$10 |
| **Total** | **~$140/mo** |

### Scale (50+ users)
| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25-75 |
| OpenAI | ~$100+ |
| Anthropic | ~$100+ |
| Upstash Redis | ~$10 |
| Sentry Business | $89 |
| Stripe | Variable |
| Resend | $20 |
| Vercel Pro | $20 |
| ClamAV (managed) | ~$100 |
| **Total** | **~$500+/mo** |
