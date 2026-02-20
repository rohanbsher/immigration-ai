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
| Rate Limiting | `/src/lib/rate-limit/` | Upstash Redis (HTTP REST), fail-closed |
| PDF Generation | `/src/lib/pdf/` | USCIS form PDF export |
| RBAC | `/src/lib/rbac/` | Role-based access control |
| Sentry | `/src/lib/sentry/` | Error tracking |
| Job Queues | `/src/lib/jobs/` | BullMQ queues via Railway Redis (TCP) |
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

### Redis Architecture (Split)
```
Vercel (Next.js)
  ├── Rate limiting  → Upstash Redis (HTTP REST, UPSTASH_REDIS_REST_URL)
  └── Job enqueue    → Railway Redis (public TCP, REDIS_URL)

Railway Worker
  └── Job processing → Railway Redis (private TCP, REDIS_URL)
```
- **Railway Redis**: BullMQ queues, noeviction, AOF persistence, Redis 8.2
- **Upstash Redis**: Rate limiting only, HTTP REST for Edge compatibility
- See `src/lib/jobs/connection.ts` for BullMQ config
- See `src/lib/rate-limit/redis.ts` for Upstash config

---

*For comprehensive details, diagrams, and data flows, see `/ARCHITECTURE.md`*
