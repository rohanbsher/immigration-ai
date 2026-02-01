# Immigration AI - Agent Quick Start

## For New Agents

### 1. Get Context (Do This First!)

```bash
# Read these files in order:
1. /.claude/CONTEXT.md          # Project state summary
2. /.claude/agents/TODO.md      # Available work streams
3. /.claude/agents/sessions/    # Recent session logs
```

### 2. Find Work

Check `TODO.md` for available work streams. Each has:
- **Status**: READY, BLOCKED, or IN_PROGRESS
- **File Ownership**: Files you'll be modifying
- **Estimated Scope**: How big the task is

### 3. Claim a Work Stream

Edit `TODO.md` and add your session ID to the work stream you're taking.

### 4. Do the Work

- Only modify files in your work stream's ownership
- Run `npm run build` frequently to verify changes
- Run `npm run test:run` before finishing

### 5. Log Your Session

Create a session log in `.claude/agents/sessions/` with format:
```
YYYY-MM-DD-HHMM-brief-description.md
```

Include:
- What you accomplished
- Files changed
- Decisions made
- What the next agent should do

---

## Project Quick Reference

### Tech Stack
- Next.js 16.1.6 with App Router
- TypeScript (strict mode)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS v4 + shadcn/ui
- OpenAI + Anthropic for AI features

### Key Directories
```
src/
├── app/          # Next.js pages and API routes
├── components/   # React components
├── hooks/        # Custom React hooks
├── lib/          # Core libraries and services
│   ├── ai/       # AI integrations
│   ├── db/       # Database services
│   ├── logger/   # Structured logging
│   └── config/   # Environment config
└── types/        # TypeScript types
```

### Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run test:run     # Run all tests
npm run lint         # Run ESLint
```

### Current Health
- Build: PASSING
- Tests: 974/977 passing (3 skipped)
- Lint: 0 errors, ~140 warnings

---

## Important Patterns

### Structured Logger
```typescript
import { createLogger } from '@/lib/logger';
const logger = createLogger('component:name');

logger.info('Something happened', { key: 'value' });
logger.logError('Something failed', error, { context: 'data' });
```

### Environment Variables
```typescript
import { env, serverEnv, features } from '@/lib/config/env';

// Client-safe vars
const url = env.NEXT_PUBLIC_SUPABASE_URL;

// Server-only vars (throws on client)
const apiKey = serverEnv.OPENAI_API_KEY;

// Feature flags
if (features.billing) { /* Stripe configured */ }
```

### Database Services
```typescript
import { casesService } from '@/lib/db/cases';

const { cases, total } = await casesService.getCases(filters, pagination);
```
