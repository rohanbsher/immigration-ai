# Shared Agent Context System

This folder enables multiple Claude agents to share context and coordinate work across sessions.

## Quick Start for New Agents

```bash
1. Read: ARCHITECTURE.md           # Understand the system
2. Read: .claude/agents/TODO.md    # Find available work streams
3. Claim a work stream             # Edit "Assigned Agent" field
4. Work ONLY on your files         # See "File Ownership" in TODO
5. Run: npm run build              # Verify after changes
6. Update TODO.md                  # Mark tasks complete
7. Write session summary           # In sessions/ folder
```

---

## Current Status (2026-01-27)

| Work Stream | Status | Can Start? |
|-------------|--------|------------|
| **WS-1: Billing** | READY | YES - Run in parallel |
| **WS-2: Multi-Tenancy** | READY | YES - Run in parallel |
| WS-3: Email | BLOCKED | NO - Wait for WS-1 |
| Phase 1-2 | COMPLETE | N/A |
| Phase 3 (Testing) | COMPLETE | N/A |

### Parallel Work Rules

**WS-1 and WS-2 CAN run simultaneously** because they own different files:

| Work Stream | Owns These Files | DO NOT Touch |
|-------------|------------------|--------------|
| WS-1 (Billing) | `/src/lib/stripe/`, `/src/app/api/billing/` | `/src/lib/organizations/` |
| WS-2 (Multi-Tenancy) | `/src/lib/organizations/`, `/src/app/api/organizations/` | `/src/lib/stripe/` |

---

## Files

### TODO.md
Master task list organized by **Work Streams**. Contains:
- Work stream status and ownership
- Detailed tasks with checkboxes
- File ownership rules (critical for parallel work)
- Cross-stream dependencies
- Verification checklists

**Always update this when you complete work!**

### ARCHITECTURE.md (in project root)
Comprehensive technical architecture:
- High-level system overview
- Database schema and relationships
- API routes catalog
- Authentication/authorization model
- AI integration details
- Security model
- Deployment architecture

**Read this before starting any work stream!**

### sessions/
Session summaries from each agent. Naming convention:
```
YYYY-MM-DD-brief-description.md
```

Each summary should include:
- What was accomplished
- Files created/modified
- Issues discovered
- Recommendations for next steps

---

## Session History

| Date | Session | Work Stream | Summary |
|------|---------|-------------|---------|
| 2026-01-26 | phase1-security | Phase 1 | File validation, virus scanning, AI confidence, audit trails, rate limiting |
| 2026-01-27 | phase2-production-hardening | Phase 2 | Redis monitoring, request timeouts, Sentry, PDF generation, RBAC |
| 2026-01-27 | architecture-planning | Planning | Created ARCHITECTURE.md, restructured TODO for parallel work |

---

## Work Stream Details

### WS-1: Billing & Payments (40-60h)

**Goal:** Stripe integration with subscription management

**Key Tasks:**
1. Database: `subscriptions`, `payments`, `invoices` tables
2. Stripe client setup with plan configuration
3. Checkout flow (create session, redirect)
4. Webhook handler (subscription events)
5. Usage tracking and limits
6. Update existing billing hooks

**Environment Variables Needed:**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

### WS-2: Multi-Tenancy (40-50h)

**Goal:** Organizations/firms with member management

**Key Tasks:**
1. Database: `organizations`, `organization_members`, `organization_invitations`
2. Organization service (CRUD operations)
3. API routes for orgs, members, invitations
4. Update existing firm hooks
5. Organization UI (settings, member management)
6. Data isolation (RLS policies)

**No new environment variables needed**

---

### WS-3: Email Notifications (20-30h)

**Goal:** Transactional emails via Resend

**BLOCKED BY:** WS-1 (needs subscription events)

**Key Tasks:**
1. Resend client setup
2. Email templates (welcome, invite, receipt, etc.)
3. Wire triggers (signup, payment, deadline, etc.)

**Environment Variables Needed:**
```bash
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@yourdomain.com
```

---

## Coordination Tips

- **Claim before starting** - Edit TODO.md "Assigned Agent" field
- **Stay in your lane** - Only modify files you own
- **Check cross-dependencies** - Note if you need changes in another stream
- **Build often** - `npm run build` after each major change
- **Document everything** - Future agents will thank you

---

## Completed Work Reference

### Phase 1 Files
- `/src/lib/file-validation/index.ts` - File + virus validation
- `/src/lib/form-validation/index.ts` - AI confidence thresholds
- `/src/app/api/forms/[id]/review-status/route.ts`
- `/src/app/api/forms/[id]/review-field/route.ts`

### Phase 2 Files
- `/src/lib/rate-limit/health.ts` - Redis health monitoring
- `/src/lib/sentry/index.ts` - Error tracking utilities
- `/src/lib/pdf/index.ts` - PDF generation
- `/src/lib/pdf/templates/index.ts` - USCIS form field mappings
- `/src/app/api/forms/[id]/pdf/route.ts` - PDF download endpoint
- `/src/hooks/use-role.ts` - Permissions hook
- `sentry.*.config.ts` - Sentry configuration files

---

## Environment Variables Reference

```bash
# Core (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Optional (Phase 2)
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
VIRUS_SCANNER_PROVIDER=...
CLAMAV_API_URL=... or VIRUSTOTAL_API_KEY=...

# WS-1: Billing
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# WS-3: Email
RESEND_API_KEY=...
EMAIL_FROM=...
```
