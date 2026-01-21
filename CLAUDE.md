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
