# Immigration AI - Claude Code Project Memory

> AI-powered immigration case management platform for attorneys

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Next.js dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with MFA
- **State**: Zustand (client) + TanStack React Query (server)
- **AI**: Anthropic Claude SDK + OpenAI
- **Forms**: React Hook Form + Zod validation

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── dashboard/         # Protected routes
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui primitives (DON'T modify)
│   ├── layout/            # Header, Sidebar, etc.
│   └── [feature]/         # Feature-specific components
├── lib/
│   ├── supabase/          # Supabase client setup
│   ├── ai/                # AI integration logic
│   └── utils/             # cn(), formatters, etc.
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript types

supabase/
└── migrations/            # SQL migration files
```

### Test Infrastructure
- `src/__mocks__/` - Module mocks for `vi.mock()` (Vitest auto-discovery)
- `src/test-utils/` - Test factories and render utilities (explicit imports)

## Architecture Patterns

### App Router Conventions
- Use Server Components by default
- Add `'use client'` only when needed (hooks, interactivity)
- Data fetching in Server Components, not client
- API routes in `app/api/` use Route Handlers

### Supabase Patterns
- Server-side: Use `createServerClient` from `@supabase/ssr`
- Client-side: Use `createBrowserClient` from `@supabase/ssr`
- Always check RLS policies when adding new tables
- Migrations go in `supabase/migrations/`

### Component Conventions
- shadcn/ui components in `components/ui/` - don't modify directly
- Feature components import from ui/
- Use `cn()` from `lib/utils` for className merging

### Form Pattern
```typescript
// Always use react-hook-form + zod
const formSchema = z.object({ ... });
type FormData = z.infer<typeof formSchema>;

const form = useForm<FormData>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `ANTHROPIC_API_KEY` - Claude API key (server-side only)
- `OPENAI_API_KEY` - OpenAI API key (server-side only)

## Common Tasks

### Adding a New Page
1. Create folder in `app/` with `page.tsx`
2. If protected: place under `dashboard/`
3. If needs data: fetch in Server Component

### Adding a shadcn/ui Component
```bash
npx shadcn@latest add [component-name]
```
Components install to `components/ui/`

### Adding Database Tables
1. Create migration file in `supabase/migrations/`
2. Add RLS policies for the table
3. Run migration in Supabase SQL editor
4. Add TypeScript types in `types/`

## AI Integration Notes

- Document analysis uses Claude vision for passport/document parsing
- Keep AI calls in `lib/ai/` - don't scatter across components
- Always handle AI errors gracefully - show user-friendly messages
- Log AI responses for audit trail (required for legal compliance)

## Security Reminders

- NEVER expose API keys to client (no NEXT_PUBLIC_ prefix for secrets)
- All document access requires RLS check
- PII handling must follow HIPAA-adjacent practices
- Audit log all document views/downloads

### Backup Codes (2FA)
- **Current:** 32 hex chars (128 bits, NIST compliant)
- **Legacy:** 8 hex chars (32 bits) still work via hash verification
- **Location:** `src/lib/2fa/backup-codes.ts`

## Verification Loop

When building/fixing features:
1. `npm run build` - Verify no TypeScript/build errors
2. `npm run lint` - Check for lint issues
3. Test in browser at localhost:3000
4. For Supabase changes: verify in Supabase dashboard

## Don't

- Don't modify `components/ui/` files directly - they're shadcn managed
- Don't put API keys in client components
- Don't bypass RLS policies
- Don't use `any` type - define proper interfaces

---

## Architecture Documentation

**For comprehensive architecture details, see `docs/ARCHITECTURE.md`**

This document covers:
- High-level system overview with diagrams
- Database schema and relationships
- API routes catalog
- Authentication/authorization layers
- AI integration patterns
- Security model
- Deployment architecture

---

## Shared Agent Context System

**IMPORTANT:** This project uses a shared context system for Claude agents working across multiple sessions.

### Quick Start for New Agents

```bash
1. Read: /ARCHITECTURE.md              # Understand the system
2. Read: /.claude/agents/TODO.md       # Find available work streams
3. Claim a work stream                 # Edit "Assigned Agent" field
4. Work ONLY on your files             # See "File Ownership" in TODO
5. Run: npm run build                  # Verify after changes
6. Update TODO.md                      # Mark tasks complete
7. Write session summary               # In sessions/ folder
```

### Folder Structure

```
.claude/
└── agents/
    ├── TODO.md              # Master task list (Work Streams)
    ├── README.md            # Quick start for agents
    └── sessions/            # Session summaries from each agent
```

### Current Project Status

| Work Stream | Status |
|-------------|--------|
| Phase 1-2 (Security, Hardening) | COMPLETE |
| Phase 3 (Testing) | COMPLETE (86%+ coverage) |
| **WS-1: Billing** | READY - Can start |
| **WS-2: Multi-Tenancy** | READY - Can start |
| WS-3: Email | BLOCKED (needs WS-1) |

**WS-1 and WS-2 can run in parallel** - they own different files.

See `.claude/agents/TODO.md` for detailed task breakdown.

### Key Services Added

| Service | Location | Purpose |
|---------|----------|---------|
| Test Utils | `/src/test-utils/` | Mock factories & test helpers |
| File Validation | `/src/lib/file-validation/` | Magic bytes + virus scanning |
| Form Validation | `/src/lib/form-validation/` | AI confidence thresholds |
| Rate Limiting | `/src/lib/rate-limit/` | Fail-closed in production |
| Request Timeouts | `/src/lib/api/fetch-with-timeout.ts` | Prevent hanging requests |
| RBAC | `/src/lib/rbac/` | Frontend route permissions |
| Sentry | `/src/lib/sentry/` | Error tracking utilities |
| PDF Generation | `/src/lib/pdf/` | USCIS form PDF generation |

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/forms/[id]/review-status` | GET | Check AI field review status |
| `/api/forms/[id]/review-field` | POST | Mark field as attorney-reviewed |
| `/api/forms/[id]/pdf` | GET | Download filled PDF form |

### Hooks for Common Patterns

| Hook | Location | Purpose |
|------|----------|---------|
| `useRoleGuard` | `/src/hooks/use-role-guard.ts` | Page-level role protection |
| `useCanPerform` | `/src/hooks/use-role-guard.ts` | Permission checking without redirect |

---

## Billing Limits - Sources of Truth

Limits are defined in THREE places that MUST stay synchronized:

1. `src/lib/billing/limits.ts` - Frontend display
2. `supabase/migrations/003_billing.sql` - plan_limits table seed
3. Database triggers (migrations 027, 032) - Enforcement

| Plan | maxCases | maxDocumentsPerCase | maxAiRequests | maxStorage | maxTeamMembers |
|------|----------|---------------------|---------------|------------|----------------|
| Free | 5 | 10 | 25 | 1 GB | 1 |
| Pro | 50 | 50 | 500 | 25 GB | 5 |
| Enterprise | ∞ | ∞ | ∞ | 500 GB | ∞ |

**Note:** Documents quota is enforced per-case (not aggregate). The UsageMeter UI shows Cases, AI Requests, and Team Members only.
