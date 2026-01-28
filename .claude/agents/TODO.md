# Immigration AI - Production Implementation TODO

> Master TODO list organized for **parallel agent execution**.
> **Last Updated:** 2026-01-28
> **Timeline:** 1 Week Sprint
> **Priority:** Multi-tenancy + Billing

---

## How to Use This File

### For Agents
1. **Read `.claude/CONTEXT.md` first** for current state
2. **Claim a work stream** by adding your agent ID to the "Assigned" field
3. **Only work on files in your work stream** to avoid conflicts
4. **Update status** as you complete tasks
5. **Write session summary** when done
6. **Update `.claude/CONTEXT.md`** with any state changes

### Work Stream Rules
- Each work stream has **exclusive file ownership**
- Agents can run in parallel on different work streams
- **DO NOT** modify files outside your work stream
- If you need a change in another stream's files, note it in "Cross-Stream Dependencies"

---

## Current Status Overview

| Work Stream | Status | Assigned | Files Owned |
|-------------|--------|----------|-------------|
| WS-1: Billing | **COMPLETE** (Code + UI) | - | `/src/lib/stripe/`, `/src/app/api/billing/` |
| WS-2: Multi-Tenancy | **COMPLETE** (Code + UI) | - | `/src/lib/organizations/`, `/src/app/api/organizations/` |
| WS-3: Email | **READY** | - | `/src/lib/email/` |
| Phase 1-2 | COMPLETE | - | - |
| Phase 3 | COMPLETE (86%+ coverage) | - | - |

---

## WORK STREAM 1: Billing & Payments

**Status:** COMPLETE (Code & UI built, needs manual testing)
**Priority:** CRITICAL
**Estimated Effort:** 40-60 hours
**Completed:** 2026-01-27

### File Ownership (Only modify these)
```
/src/lib/stripe/                    # NEW - Create this folder
/src/app/api/billing/               # NEW - Create this folder
/src/app/dashboard/billing/         # MODIFY existing
/src/hooks/use-subscription.ts      # MODIFY existing
/supabase/migrations/XXX_billing.sql # NEW migration
```

### DO NOT MODIFY (owned by other streams)
```
/src/lib/organizations/             # WS-2 owns this
/src/app/api/firms/                 # WS-2 owns this
```

### Tasks

#### 1.1 Database Schema (4h)
- [ ] Create migration: `subscriptions` table
- [ ] Create migration: `payments` table
- [ ] Create migration: `invoices` table
- [ ] Add `subscription_id` FK to `profiles` table
- [ ] Add RLS policies for billing tables

**Schema:**
```sql
-- subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_payment_intent_id TEXT,
  amount INTEGER, -- cents
  currency TEXT DEFAULT 'usd',
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Stripe Client Setup (4h)
- [ ] Install `stripe` package
- [ ] Create `/src/lib/stripe/client.ts` - Server-side Stripe client
- [ ] Create `/src/lib/stripe/config.ts` - Plan definitions, prices
- [ ] Create `/src/lib/stripe/helpers.ts` - Common operations

**Plan Configuration:**
```typescript
export const PLANS = {
  free: {
    name: 'Free',
    priceId: null,
    limits: { cases: 1, documents: 10, aiCalls: 5 }
  },
  pro: {
    name: 'Pro',
    priceId: 'price_xxx',
    limits: { cases: -1, documents: -1, aiCalls: 100 }
  },
  enterprise: {
    name: 'Enterprise',
    priceId: 'price_yyy',
    limits: { cases: -1, documents: -1, aiCalls: -1 }
  }
};
```

#### 1.3 Checkout Flow (8h)
- [ ] Create `/src/app/api/billing/checkout/route.ts`
  - POST: Create Stripe checkout session
- [ ] Create `/src/app/api/billing/portal/route.ts`
  - POST: Create Stripe customer portal session
- [ ] Update `/src/app/dashboard/billing/page.tsx`
  - Show current plan
  - Upgrade/downgrade buttons
  - Billing history

#### 1.4 Webhook Handler (8h)
- [ ] Create `/src/app/api/billing/webhook/route.ts`
- [ ] Handle events:
  - `checkout.session.completed` - Create subscription
  - `customer.subscription.updated` - Update status
  - `customer.subscription.deleted` - Cancel subscription
  - `invoice.payment_succeeded` - Record payment
  - `invoice.payment_failed` - Handle failure
- [ ] Verify webhook signature

#### 1.5 Usage Tracking & Limits (8h)
- [ ] Create `/src/lib/stripe/usage.ts`
  - `checkQuota(userId, resource)` - Check if under limit
  - `incrementUsage(userId, resource)` - Increment counter
  - `getUsage(userId)` - Get current usage
- [ ] Add usage checks to:
  - Case creation (check case limit)
  - Document upload (check document limit)
  - AI operations (check AI call limit)

#### 1.6 Update Hooks (4h)
- [ ] Update `/src/hooks/use-subscription.ts`
  - Add `createCheckoutSession()`
  - Add `openBillingPortal()`
  - Add `getUsage()`
  - Add `canUseFeature(feature)`

### Environment Variables Needed
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Verification Checklist
- [ ] Can create checkout session
- [ ] Webhook handles all events correctly
- [ ] Subscription status syncs to database
- [ ] Usage limits enforced
- [ ] Billing portal accessible
- [ ] Build passes

---

## WORK STREAM 2: Multi-Tenancy (Organizations/Firms)

**Status:** COMPLETE (Code & UI built, needs manual testing)
**Priority:** CRITICAL
**Estimated Effort:** 40-50 hours
**Completed:** 2026-01-27

### File Ownership (Only modify these)
```
/src/lib/organizations/             # NEW - Create this folder
/src/app/api/organizations/         # NEW - Create this folder
/src/app/dashboard/firm/            # MODIFY existing
/src/hooks/use-firm.ts              # MODIFY existing
/src/hooks/use-firm-members.ts      # MODIFY existing
/supabase/migrations/XXX_orgs.sql   # NEW migration
```

### DO NOT MODIFY (owned by other streams)
```
/src/lib/stripe/                    # WS-1 owns this
/src/app/api/billing/               # WS-1 owns this
```

### Tasks

#### 2.1 Database Schema (4h)
- [ ] Create migration: `organizations` table (rename from firms)
- [ ] Create migration: `organization_members` table
- [ ] Create migration: `organization_invitations` table
- [ ] Add `organization_id` to `cases` table
- [ ] Add RLS policies for organization data isolation

**Schema:**
```sql
-- organizations (firms)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- organization_members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- organization_invitations
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2.2 Organization Service (6h)
- [ ] Create `/src/lib/organizations/index.ts`
  - `createOrganization(name, ownerId)`
  - `getOrganization(id)`
  - `updateOrganization(id, data)`
  - `deleteOrganization(id)`
- [ ] Create `/src/lib/organizations/members.ts`
  - `addMember(orgId, userId, role)`
  - `removeMember(orgId, userId)`
  - `updateMemberRole(orgId, userId, role)`
  - `getMembers(orgId)`
- [ ] Create `/src/lib/organizations/invitations.ts`
  - `createInvitation(orgId, email, role)`
  - `acceptInvitation(token)`
  - `revokeInvitation(id)`
  - `getInvitations(orgId)`

#### 2.3 API Routes (8h)
- [ ] Create `/src/app/api/organizations/route.ts`
  - GET: List user's organizations
  - POST: Create organization
- [ ] Create `/src/app/api/organizations/[id]/route.ts`
  - GET: Get organization
  - PATCH: Update organization
  - DELETE: Delete organization
- [ ] Create `/src/app/api/organizations/[id]/members/route.ts`
  - GET: List members
  - POST: Add member
  - DELETE: Remove member
- [ ] Create `/src/app/api/organizations/[id]/invitations/route.ts`
  - GET: List invitations
  - POST: Create invitation
  - DELETE: Revoke invitation
- [ ] Create `/src/app/api/invitations/[token]/accept/route.ts`
  - POST: Accept invitation

#### 2.4 Update Hooks (4h)
- [ ] Update `/src/hooks/use-firm.ts` → rename to `use-organization.ts`
  - Add organization CRUD operations
  - Add current organization context
- [ ] Update `/src/hooks/use-firm-members.ts` → rename to `use-organization-members.ts`
  - Add invitation operations
  - Add member role management

#### 2.5 Organization UI (8h)
- [ ] Update `/src/app/dashboard/firm/page.tsx`
  - Organization settings
  - Member list
  - Pending invitations
- [ ] Create `/src/app/dashboard/firm/members/page.tsx`
  - Member management
  - Invite form
- [ ] Create `/src/components/organization/organization-switcher.tsx`
  - Switch between organizations (for users in multiple)

#### 2.6 Data Isolation (4h)
- [ ] Update case queries to filter by organization
- [ ] Update document queries to filter by organization
- [ ] Verify RLS policies work correctly
- [ ] Add organization context to audit logs

### Verification Checklist
- [ ] Can create organization
- [ ] Can invite members via email
- [ ] Invitations can be accepted
- [ ] Cases are isolated by organization
- [ ] Members can only see their org's data
- [ ] Owner can transfer ownership
- [ ] Build passes

---

## WORK STREAM 3: Email Notifications

**Status:** READY TO START (WS-1 complete, unblocked)
**Priority:** HIGH
**Estimated Effort:** 20-30 hours
**Assigned Agent:** _none_
**Requires:** Resend API key configuration

### File Ownership (Only modify these)
```
/src/lib/email/                     # NEW - Create this folder
/src/app/api/notifications/         # MODIFY existing
```

### Tasks (Start after WS-1 is done)

#### 3.1 Email Service Setup (4h)
- [ ] Install `resend` package
- [ ] Create `/src/lib/email/client.ts` - Resend client
- [ ] Create `/src/lib/email/templates/` folder
- [ ] Create base email template (HTML/React)

#### 3.2 Email Templates (8h)
- [ ] Welcome email template
- [ ] Invitation email template
- [ ] Password reset template
- [ ] Deadline reminder template
- [ ] Document uploaded notification
- [ ] Case status change notification
- [ ] Payment receipt template
- [ ] Subscription canceled template

#### 3.3 Email Triggers (8h)
- [ ] Wire email sending to:
  - User signup (welcome)
  - Org invitation (invite link)
  - Password reset (reset link)
  - Deadline approaching (3 days, 1 day)
  - Document uploaded (notify attorney)
  - Case status change (notify client)
  - Payment success (receipt)
  - Payment failed (warning)

### Environment Variables Needed
```bash
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@yourdomain.com
```

---

## COMPLETED WORK

### Phase 1: Critical Security (COMPLETE)
**Completed:** 2026-01-26

| Task | Files |
|------|-------|
| Virus/Malware Scanning | `/src/lib/file-validation/` |
| Magic Byte Validation | `/src/lib/file-validation/` |
| AI Confidence Thresholds | `/src/lib/form-validation/` |
| Attorney Audit Trail | `/src/app/api/forms/` |
| Rate Limiting Safety | `/src/lib/rate-limit/` |

### Phase 2: Production Hardening (COMPLETE)
**Completed:** 2026-01-27

| Task | Files |
|------|-------|
| Redis Health Monitoring | `/src/lib/rate-limit/health.ts` |
| Request Timeouts | `/src/lib/api/fetch-with-timeout.ts`, all hooks |
| Sentry Error Tracking | `/src/lib/sentry/`, `sentry.*.config.ts` |
| PDF Generation | `/src/lib/pdf/` |
| Frontend RBAC | `/src/hooks/use-role.ts`, `/src/lib/rbac/` |

### Phase 3: Testing (COMPLETE)
**Completed:** 2026-01-27

| Task | Files |
|------|-------|
| E2E Tests (Playwright) | `tests/e2e/*.spec.ts` |
| Unit Test Coverage 86%+ | Vitest |

---

## DEFERRED WORK (Not This Sprint)

### Accessibility (WCAG 2.1)
- Skip for this sprint per user request
- Will revisit after core SaaS features

### Internationalization (i18n)
- Skip for this sprint
- Will revisit when expanding to international markets

### Upload Progress Indicators
- Nice to have, not blocking

### AI Prompt Versioning
- Nice to have, not blocking

---

## Cross-Stream Dependencies

### WS-1 → WS-2
When billing is done, WS-2 needs to:
- Add organization-level billing (org pays for all members)
- Link subscription to organization instead of individual

### WS-1 → WS-3
When billing is done, WS-3 needs to:
- Send payment receipt emails
- Send subscription status emails

### WS-2 → WS-3
When multi-tenancy is done, WS-3 needs to:
- Send invitation emails
- Support org-level notification preferences

---

## Agent Session Log

| Date | Agent | Work Stream | Summary |
|------|-------|-------------|---------|
| 2026-01-26 | Opus 4.5 | Phase 1 | File validation, AI confidence, audit trails |
| 2026-01-27 | Opus 4.5 | Phase 2 | Redis, timeouts, Sentry, PDF, RBAC |
| 2026-01-27 | Opus 4.5 | Phase 3 | E2E tests, coverage |
| 2026-01-27 | Opus 4.5 | Planning | Created ARCHITECTURE.md, restructured TODO |
| 2026-01-27 | Opus 4.5 | WS-1 + WS-2 | Built Billing UI + Firm Management UI |
| 2026-01-28 | Opus 4.5 | Infrastructure | Applied DB migrations, created RUNNING_CONTEXT system |

---

## How to Start a Work Stream

1. **Read this TODO** thoroughly
2. **Claim the work stream** by editing the "Assigned Agent" field
3. **Read ARCHITECTURE.md** for context
4. **Read recent session summaries** in `/sessions/`
5. **Create your files** only in your owned directories
6. **Run `npm run build`** after each major change
7. **Update this TODO** with task completion status
8. **Write session summary** when done

---

## Environment Variables Reference

```bash
# Existing (configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Phase 2 (optional)
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...

# WS-1: Billing (add when implementing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# WS-3: Email (add when implementing)
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@yourdomain.com
```
