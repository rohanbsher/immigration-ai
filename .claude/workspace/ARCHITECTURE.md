# Architecture Reference

> Full architecture documentation is in the project root: `/ARCHITECTURE.md`

## Quick Reference

### Tech Stack
- **Frontend:** Next.js 16, React 19, TailwindCSS v4, shadcn/ui
- **Backend:** Next.js API Routes, Server Actions
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth with MFA
- **AI:** Anthropic Claude + OpenAI GPT-4o
- **State:** Zustand (client) + TanStack Query (server)

### Key Directories
```
src/
├── app/           # Next.js App Router pages
├── components/    # UI components
├── lib/           # Business logic, utilities
├── hooks/         # Custom React hooks
└── types/         # TypeScript types

supabase/
└── migrations/    # Database migrations
```

### Core Services
| Service | Location | Purpose |
|---------|----------|---------|
| File Validation | `/src/lib/file-validation/` | Magic bytes + virus scanning |
| Form Validation | `/src/lib/form-validation/` | AI confidence thresholds |
| Rate Limiting | `/src/lib/rate-limit/` | Upstash Redis, fail-closed |
| PDF Generation | `/src/lib/pdf/` | USCIS form PDF export |
| RBAC | `/src/lib/rbac/` | Role-based access control |
| Sentry | `/src/lib/sentry/` | Error tracking |
| Job Queues | `/src/lib/jobs/` | BullMQ queues with shutdown hooks |
| Fetch Timeout | `/src/lib/api/fetch-with-timeout.ts` | Request timeouts + AbortSignal polyfill |
| Circuit Breaker | `/src/lib/ai/circuit-breaker.ts` | AI provider failure isolation |

### Database Tables
- `profiles` - User profiles
- `cases` - Immigration cases
- `documents` - Uploaded documents
- `forms` - USCIS form data
- `form_fields` - AI-extracted field values
- `audit_logs` - Compliance audit trail

---

*For comprehensive details, diagrams, and data flows, see `/ARCHITECTURE.md`*
