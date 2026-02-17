# MVP Launch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Immigration AI as a working MVP with all services wired, backend gaps fixed, and a distinctive visual redesign.

**Architecture:** Five sequential phases — consolidate uncommitted work, wire 4 external services (Redis, Sentry, Resend, Stripe), fix 4 backend API gaps, redesign all pages with Frontend Design skill, then verify and deploy. Each phase uses Ralph Loop for iterative execution.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Supabase, Stripe, Resend, Sentry, Upstash Redis

---

## Phase 1: Commit & Consolidate

### Task 1.1: Verify build and tests with uncommitted changes

**Files:**
- Check: all 16 modified/untracked files listed in `git status`

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build, 0 errors. If errors occur, fix them before proceeding.

**Step 2: Run tests**

```bash
npm run test:run
```

Expected: All tests pass. If failures occur, fix them.

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 1.2: Commit security changes

**Files:**
- `src/lib/ai/pii-filter.ts` (new)
- `supabase/migrations/051_audit_log_append_only.sql` (new)
- `supabase/migrations/052_encrypt_form_sensitive_fields.sql` (new)

**Step 1: Stage and commit security files**

```bash
git add src/lib/ai/pii-filter.ts supabase/migrations/051_audit_log_append_only.sql supabase/migrations/052_encrypt_form_sensitive_fields.sql
git commit -m "feat: add PII filtering, append-only audit log, and form encryption migration"
```

---

### Task 1.3: Commit backend changes

**Files:**
- Modify: `src/lib/db/clients.ts`
- Modify: `src/lib/db/forms.ts`
- Modify: `src/app/api/cases/[id]/documents/route.ts`
- Modify: `src/app/api/cases/[id]/messages/route.ts`
- Modify: `src/app/api/cases/[id]/route.ts`
- Modify: `src/lib/ai/anthropic.ts`
- Modify: `src/lib/ai/chat/tools.ts`

**Step 1: Stage and commit backend changes**

```bash
git add src/lib/db/clients.ts src/lib/db/forms.ts src/app/api/cases/\[id\]/documents/route.ts src/app/api/cases/\[id\]/messages/route.ts src/app/api/cases/\[id\]/route.ts src/lib/ai/anthropic.ts src/lib/ai/chat/tools.ts
git commit -m "fix: optimize client/form queries, harden case APIs, integrate PII filter"
```

---

### Task 1.4: Commit frontend and test changes

**Files:**
- Modify: `src/components/chat/chat-button.tsx`
- Modify: `src/components/consent/cookie-consent-banner.tsx`
- Modify: `src/components/settings/gdpr-data-management.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/hooks/use-consent.test.ts`
- Modify: `src/hooks/use-consent.ts`
- Modify: `src/lib/utils.test.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/db/index.test.ts`
- Create: `src/components/chat/chat-button.test.tsx`

**Step 1: Stage and commit**

```bash
git add src/components/chat/chat-button.tsx src/components/consent/cookie-consent-banner.tsx src/components/settings/gdpr-data-management.tsx src/app/globals.css src/hooks/use-consent.test.ts src/hooks/use-consent.ts src/lib/utils.test.ts src/lib/utils.ts src/lib/db/index.test.ts src/components/chat/chat-button.test.tsx
git commit -m "fix: consent/chat/GDPR refinements with updated tests"
```

---

### Task 1.5: Commit infrastructure files

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/` (directory with RLS test files)

**Step 1: Stage and commit**

```bash
git add supabase/config.toml supabase/seed.sql supabase/tests/
git commit -m "feat: add Supabase local dev config, seed data, and RLS tests"
```

**Step 2: Verify clean working tree**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

---

## Phase 2: Wire External Services

### Task 2.1: Wire Upstash Redis for rate limiting

**Files:**
- Check: `src/lib/rate-limit/index.ts` (already has Redis support)
- Check: `src/lib/redis/index.ts` (Redis client factory)
- Modify: `.env.local` (add keys)

**Step 1: Add env vars to `.env.local`**

Add these two variables (get values from Upstash dashboard):
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Step 2: Verify Redis detection**

Start dev server and check logs for Redis connection:
```bash
npm run dev
```

In another terminal, hit a rate-limited endpoint:
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}' -v 2>&1 | grep -i "x-ratelimit"
```

Expected: `x-ratelimit-limit` and `x-ratelimit-remaining` headers present.

**Step 3: Run tests**

```bash
npm run test:run
```

Expected: All pass (rate limit tests mock Redis).

**Step 4: Commit**

```bash
git commit -m "chore: configure Upstash Redis for distributed rate limiting"
```

Note: `.env.local` is gitignored. This commit is only for any code changes needed.

---

### Task 2.2: Wire Sentry error tracking

**Files:**
- Check: `next.config.ts` (Sentry conditional integration)
- Check: `src/lib/sentry/` (Sentry utilities)
- Modify: `.env.local` (add DSN)

**Step 1: Add env vars to `.env.local`**

```
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org
SENTRY_PROJECT=immigration-ai
```

**Step 2: Verify Sentry activates on build**

```bash
npm run build
```

Expected: Build succeeds, Sentry sourcemap upload step appears in output.

**Step 3: Verify error capture**

Start dev server and trigger an error:
```bash
npm run dev
```

Navigate to the app and trigger an error (e.g., visit a page that throws). Check Sentry dashboard for the event.

**Step 4: Run tests**

```bash
npm run test:run
```

Expected: All pass.

---

### Task 2.3: Wire Resend transactional email

**Files:**
- Check: `src/lib/email/client.ts` (Resend client factory)
- Check: `src/lib/email/notifications.ts` (email sending functions)
- Check: `src/lib/email/templates/` (HTML email templates)
- Modify: `.env.local` (add key)

**Step 1: Add env var to `.env.local`**

```
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Step 2: Verify email client connects**

Start dev server and register a new user. Check Resend dashboard for the welcome email delivery.

**Step 3: Test deadline reminder email**

Call the cron endpoint with the cron secret:
```bash
curl http://localhost:3000/api/cron/deadline-alerts -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Check Resend dashboard for any deadline reminder emails (requires cases with upcoming deadlines).

**Step 4: Run tests**

```bash
npm run test:run
```

Expected: All pass (email tests mock Resend).

---

### Task 2.4: Wire Stripe billing

**Files:**
- Check: `src/lib/stripe/client.ts` (Stripe client factory)
- Check: `src/lib/stripe/webhooks.ts` (webhook handler)
- Check: `src/lib/billing/limits.ts` (plan definitions)
- Modify: `src/app/api/admin/stats/route.ts:82-83` (fix hardcoded MRR)
- Test: `src/app/api/admin/stats/route.test.ts` (update test for MRR)
- Modify: `.env.local` (add Stripe keys)

**Step 1: Add env vars to `.env.local`**

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
```

**Step 2: Create Stripe products and prices**

In Stripe dashboard, create:
- Product: "Immigration AI Pro" with monthly ($49/mo) and yearly ($470/yr) prices
- Product: "Immigration AI Enterprise" with monthly ($149/mo) and yearly ($1,430/yr) prices
- Copy price IDs into `.env.local`

**Step 3: Write failing test for MRR calculation**

Create or update test file for admin stats. The test should verify MRR is calculated from active subscriptions, not hardcoded to 0.

**Step 4: Fix hardcoded MRR**

Modify `src/app/api/admin/stats/route.ts:82-83`. Replace:
```typescript
mrr: 0,
mrrGrowth: 0,
```

With a query that sums monthly amounts from active subscriptions. Use the Stripe client to list active subscriptions and calculate MRR:
```typescript
// Calculate MRR from active subscriptions
let mrr = 0;
let mrrGrowth = 0;
const stripe = getStripeClient();
if (stripe) {
  try {
    const activeSubscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });
    mrr = activeSubscriptions.data.reduce((sum, sub) => {
      const item = sub.items.data[0];
      if (!item?.price?.unit_amount) return sum;
      // Normalize to monthly: yearly prices / 12
      const interval = item.price.recurring?.interval;
      const amount = item.price.unit_amount / 100;
      return sum + (interval === 'year' ? amount / 12 : amount);
    }, 0);
    mrr = Math.round(mrr * 100) / 100;
  } catch (error) {
    log.logError('Failed to calculate MRR from Stripe', error);
  }
}
```

**Step 5: Run test to verify it passes**

```bash
npm run test:run -- --grep "admin stats"
```

Expected: PASS

**Step 6: Verify checkout flow**

Start dev server, navigate to billing page, click upgrade to Pro. Verify Stripe checkout opens. Complete with test card `4242 4242 4242 4242`. Verify subscription appears.

**Step 7: Set up webhook forwarding for local dev**

```bash
stripe listen --forward-to localhost:3000/api/billing/webhooks
```

Verify webhook events are received and processed.

**Step 8: Run full test suite**

```bash
npm run build && npm run test:run
```

Expected: Clean build, all tests pass.

**Step 9: Commit**

```bash
git add src/app/api/admin/stats/route.ts
git commit -m "feat: wire Stripe billing and calculate real MRR from active subscriptions"
```

---

## Phase 3: Fix Backend Gaps

### Task 3.1: Add task comments API route

**Files:**
- Create: `src/app/api/tasks/[id]/comments/route.ts`
- Test: `src/app/api/tasks/[id]/comments/route.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/tasks/[id]/comments/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/supabase/admin');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/db');

import { GET, POST } from './route';
import { tasksService } from '@/lib/db';

describe('GET /api/tasks/[id]/comments', () => {
  it('returns comments for a task', async () => {
    const mockComments = [
      { id: '1', task_id: 'task-1', content: 'Test comment', user: { id: 'u1', first_name: 'Test', last_name: 'User' } }
    ];
    vi.mocked(tasksService.getComments).mockResolvedValue(mockComments as any);

    const request = new Request('http://localhost/api/tasks/task-1/comments');
    const response = await GET(request as any, { params: Promise.resolve({ id: 'task-1' }) } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/tasks/[id]/comments', () => {
  it('creates a comment', async () => {
    const mockComment = { id: '2', task_id: 'task-1', content: 'New comment' };
    vi.mocked(tasksService.addComment).mockResolvedValue(mockComment as any);

    const request = new Request('http://localhost/api/tasks/task-1/comments', {
      method: 'POST',
      body: JSON.stringify({ content: 'New comment' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request as any, { params: Promise.resolve({ id: 'task-1' }) } as any);

    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/app/api/tasks/\\[id\\]/comments/route.test.ts
```

Expected: FAIL (module not found)

**Step 3: Write the route handler**

Create `src/app/api/tasks/[id]/comments/route.ts`:

```typescript
import { tasksService } from '@/lib/db';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { withAuth, errorResponse, successResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:task-comments');

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/tasks/[id]/comments - Get comments for a task
 */
export const GET = withAuth(async (_request, context, auth) => {
  try {
    const { id } = await context.params!;
    const comments = await tasksService.getComments(id);
    return successResponse(comments);
  } catch (error) {
    log.logError('Failed to get task comments', error);
    return errorResponse('Failed to get comments', 500);
  }
});

/**
 * POST /api/tasks/[id]/comments - Add a comment to a task
 */
export const POST = withAuth(async (request, context, auth) => {
  try {
    const { id } = await context.params!;

    const body = await safeParseBody(request, createCommentSchema);
    if (!body.success) {
      return errorResponse(body.error, 400);
    }

    const comment = await tasksService.addComment(id, auth.user.id, body.data.content);
    return successResponse(comment);
  } catch (error) {
    log.logError('Failed to create task comment', error);
    return errorResponse('Failed to create comment', 500);
  }
});
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/app/api/tasks/\\[id\\]/comments/route.test.ts
```

Expected: PASS

**Step 5: Run build**

```bash
npm run build
```

Expected: Clean build.

**Step 6: Commit**

```bash
git add src/app/api/tasks/\[id\]/comments/
git commit -m "feat: add task comments API route (GET+POST)"
```

---

### Task 3.2: Add billing invoices API route

**Files:**
- Create: `src/app/api/billing/invoices/route.ts`
- Test: `src/app/api/billing/invoices/route.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/billing/invoices/route.test.ts` testing that GET returns invoices for the authenticated user.

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/app/api/billing/invoices/route.test.ts
```

Expected: FAIL

**Step 3: Write the route handler**

Create `src/app/api/billing/invoices/route.ts`:

```typescript
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getUserInvoices } from '@/lib/db/subscriptions';

const log = createLogger('api:billing-invoices');

/**
 * GET /api/billing/invoices - Get invoice history for the authenticated user
 */
export const GET = withAuth(async (_request, _context, auth) => {
  try {
    const invoices = await getUserInvoices(auth.user.id);
    return successResponse(invoices);
  } catch (error) {
    log.logError('Failed to get invoices', error);
    return errorResponse('Failed to fetch invoices', 500);
  }
});
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/app/api/billing/invoices/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/billing/invoices/
git commit -m "feat: add billing invoices API route"
```

---

### Task 3.3: Add AI consent GET endpoint

**Files:**
- Modify: `src/app/api/profile/ai-consent/route.ts` (add GET handler)

**Step 1: Write the failing test**

Add a test case that calls GET and expects it to return the consent status.

**Step 2: Run test to verify it fails**

Expected: FAIL (GET not exported or returns 405)

**Step 3: Add GET handler**

Add to `src/app/api/profile/ai-consent/route.ts`:

```typescript
/**
 * GET /api/profile/ai-consent
 * Check AI consent status for the authenticated user.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('ai_consent_granted_at')
      .eq('id', user.id)
      .single();

    if (error) {
      log.logError('Failed to check AI consent', error);
      return NextResponse.json({ error: 'Failed to check consent' }, { status: 500 });
    }

    return NextResponse.json({
      consented: !!profile?.ai_consent_granted_at,
      consentedAt: profile?.ai_consent_granted_at || null,
    });
  } catch (error) {
    log.logError('Error checking AI consent', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/app/api/profile/ai-consent/
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/profile/ai-consent/route.ts
git commit -m "feat: add GET handler for AI consent status check"
```

---

### Task 3.4: Remove admin activity feed placeholder

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`

**Step 1: Find and remove the placeholder**

Search for "Activity feed coming soon" in `src/app/admin/dashboard/page.tsx` and remove the placeholder card entirely, or replace it with real data if the `activities` table is populated.

**Step 2: Run build**

```bash
npm run build
```

Expected: Clean build.

**Step 3: Commit**

```bash
git add src/app/admin/dashboard/page.tsx
git commit -m "fix: remove placeholder activity feed from admin dashboard"
```

---

### Task 3.5: Phase 3 verification

**Step 1: Run full test suite**

```bash
npm run test:run && npm run build && npx tsc --noEmit
```

Expected: All pass, clean build, zero type errors.

---

## Phase 4: Full Visual Redesign

> Each group below is a separate session using the Frontend Design skill + Ralph Loop.
> The process for each: `Frontend Design skill` → implement → `Ralph Loop` iterates → `/grill` → commit.

### Task 4.1: Establish design direction

**Step 1: Invoke Frontend Design skill**

Before any page work, establish the aesthetic direction for the entire app. Consider:
- Immigration law = trust, precision, authority
- The audience: attorneys who work 10+ hour days in this tool
- Differentiation from generic SaaS dashboards

Pick distinctive fonts (NOT Geist, Inter, or Roboto), a refined color palette, and a clear visual language.

**Step 2: Update design tokens**

Modify `src/app/globals.css` to update the OKLCH color tokens, font imports, and any new CSS variables.

**Step 3: Commit design foundation**

```bash
git add src/app/globals.css
git commit -m "feat: establish distinctive design direction for MVP"
```

---

### Task 4.2: Redesign landing page

**Files:**
- Modify: `src/app/page.tsx`

**Ralph Loop Prompt:**
```
Redesign the landing page at src/app/page.tsx using the Frontend Design
skill aesthetic. Create a premium, trustworthy first impression for
immigration attorneys. Include: hero section, feature highlights,
how-it-works flow, social proof, pricing comparison, and footer.
Replace placeholder testimonials with realistic attorney profiles.
Run npm run build after changes. Output <promise>LANDING DONE</promise>
when the page is polished and builds cleanly.
```

**Step 1: Invoke Frontend Design skill with landing page context**
**Step 2: Implement the redesign**
**Step 3: Run build to verify**
**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing page with premium legal-tech aesthetic"
```

---

### Task 4.3: Redesign auth pages

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/(auth)/reset-password/page.tsx`

**Ralph Loop Prompt:**
```
Redesign all auth pages under src/app/(auth)/ to match the new design
direction. Keep inline error banners (not toast). Keep OAuth buttons
(Google + Microsoft). Make them branded, confident, and minimal.
Run npm run build after changes. Output <promise>AUTH DONE</promise>
when all 4 auth pages are polished and build cleanly.
```

---

### Task 4.4: Redesign dashboard shell

**Files:**
- Modify: `src/components/layout/dashboard-layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/command-palette.tsx`

**Ralph Loop Prompt:**
```
Redesign the dashboard shell: sidebar, header, and command palette.
This is the workspace attorneys use 8+ hours/day — it must feel
efficient, refined, and distinctive. Keep all existing functionality
(collapsible sidebar, RBAC nav filtering, keyboard shortcuts,
notifications, search, user menu). Run npm run build after changes.
Output <promise>SHELL DONE</promise> when polished and clean.
```

---

### Task 4.5: Redesign dashboard home + analytics

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/analytics/page.tsx`
- Modify: `src/components/dashboard/deadline-widget.tsx`
- Modify: `src/components/dashboard/tasks-widget.tsx`
- Modify: `src/components/visualizations/` (all chart components)

**Ralph Loop Prompt:**
```
Redesign the dashboard home page and analytics page. Data-dense but
elegant. KPI cards with animated counters, Recharts donut/bar charts,
deadline widget, tasks widget. Apply the new design language.
Run npm run build after changes. Output <promise>DASHBOARD DONE</promise>
when both pages are polished and build cleanly.
```

---

### Task 4.6: Redesign cases + case detail

**Files:**
- Modify: `src/app/dashboard/cases/page.tsx`
- Modify: `src/app/dashboard/cases/[id]/page.tsx`
- Modify: `src/app/dashboard/cases/new/page.tsx`
- Modify: `src/components/cases/` (all case components)
- Modify: `src/components/ai/` (AI panels used in case detail)

**Ralph Loop Prompt:**
```
Redesign the cases list page, case detail page (6 tabs), and new case
form. This is the core workflow — most-used pages. Card/table toggle,
filters, status badges, document completeness panel, AI recommendations,
message thread. Apply the new design language consistently.
Run npm run build after changes. Output <promise>CASES DONE</promise>
when all case pages are polished and build cleanly.
```

---

### Task 4.7: Redesign all remaining pages

**Files:**
- Modify: `src/app/dashboard/documents/page.tsx`
- Modify: `src/app/dashboard/forms/page.tsx` + `[id]/page.tsx`
- Modify: `src/app/dashboard/tasks/page.tsx`
- Modify: `src/app/dashboard/clients/page.tsx` + `[id]/page.tsx`
- Modify: `src/app/dashboard/billing/page.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`
- Modify: `src/app/dashboard/firm/page.tsx`
- Modify: `src/app/dashboard/notifications/page.tsx`
- Modify: `src/app/admin/` (all admin pages)
- Modify: All related components in `src/components/`

**Ralph Loop Prompt:**
```
Redesign all remaining dashboard pages: documents, forms, tasks,
clients, billing, settings, firm, notifications, and admin pages.
Apply the design language established in previous groups. Consistency
is key — every page should feel like part of the same premium product.
Run npm run build after changes. Output <promise>PAGES DONE</promise>
when all pages are polished and build cleanly.
```

---

### Task 4.8: Phase 4 verification

**Step 1: Run full verification**

```bash
npm run test:run && npm run build && npx tsc --noEmit && npm run lint
```

Expected: All pass.

**Step 2: Visual review**

Start dev server and manually review every page:
- Landing page
- Login / Register / Forgot password / Reset password
- Dashboard home
- Cases list → Case detail (all 6 tabs)
- Documents, Forms, Tasks, Clients
- Billing, Settings, Firm, Notifications
- Analytics
- Admin dashboard

**Step 3: Commit any final tweaks**

```bash
git add -A
git commit -m "feat: complete visual redesign — all pages polished"
```

---

## Phase 5: E2E Verification & Deploy

### Task 5.1: Run full verification suite

**Step 1: Tests**

```bash
npm run test:run
```

Expected: All pass.

**Step 2: Build**

```bash
npm run build
```

Expected: Clean build.

**Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Lint**

```bash
npm run lint
```

Expected: Clean.

---

### Task 5.2: Manual walkthrough of core flows

**Step 1: Attorney flow**

1. Register new attorney account
2. Login
3. Create a case (H-1B visa)
4. Upload a passport document
5. Trigger AI document analysis
6. Create a form (I-129)
7. Trigger AI form autofill
8. Review autofilled fields
9. Generate PDF

**Step 2: Billing flow**

1. Navigate to billing page
2. Click upgrade to Pro
3. Complete Stripe checkout (test card: 4242 4242 4242 4242)
4. Verify subscription appears
5. Open customer portal
6. Cancel subscription
7. Resume subscription

**Step 3: Firm flow**

1. Create a firm
2. Invite a team member
3. Verify invitation email arrives

**Step 4: Settings flow**

1. Update profile
2. Set up 2FA
3. Update notification preferences

---

### Task 5.3: Set Vercel env vars and deploy

**Step 1: Set all env vars on Vercel production**

Required:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL
OPENAI_API_KEY
ANTHROPIC_API_KEY
ENCRYPTION_KEY
CRON_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN
RESEND_API_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_YEARLY
STRIPE_PRICE_ENTERPRISE_MONTHLY
STRIPE_PRICE_ENTERPRISE_YEARLY
```

**Step 2: Push to main**

```bash
git push origin main
```

**Step 3: Wait for Vercel deployment**

Monitor Vercel dashboard for deployment completion.

**Step 4: Post-deploy smoke test**

```bash
curl https://your-production-url.vercel.app/api/health
```

Expected: `{ "status": "healthy" }`

**Step 5: Spot-check 3 critical flows in production**

1. Login with real credentials
2. View dashboard
3. Navigate to billing page

---

## Execution Summary

| Phase | Tasks | Estimated Ralph Loop Iterations |
|-------|-------|---------------------------------|
| 1. Consolidate | 5 tasks | 3-5 |
| 2. Services | 4 tasks | ~25 total |
| 3. Backend Gaps | 5 tasks | 3-5 |
| 4. Redesign | 8 tasks | ~40 total |
| 5. Deploy | 3 tasks | 3-5 |
| **Total** | **25 tasks** | **~75 iterations** |
