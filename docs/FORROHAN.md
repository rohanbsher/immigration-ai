# CaseFill - Learning Journal

> A friendly guide to understanding this codebase, written for you to remember what we built and why.

---

## What Is This Project?

**CaseFill** is a SaaS platform that helps immigration attorneys manage their cases more efficiently using AI. Think of it as a smart assistant that can:

1. **Read documents** - Upload a passport, and AI extracts all the relevant data
2. **Fill forms automatically** - AI takes extracted data and fills USCIS forms like I-130, I-485, etc.
3. **Track cases** - Dashboard to manage multiple clients and their immigration cases
4. **Generate PDFs** - Export filled forms for filing

The magic is in the **AI-powered document extraction** and **form autofill**. Instead of attorneys manually typing the same information over and over, the system does it automatically.

---

## Architecture Overview

### The Stack (And Why We Chose It)

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Next.js 16 (App Router) + React 19 + Tailwind + shadcn/ui │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│              Next.js Route Handlers (/app/api/)              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Supabase     │  │   Claude API    │  │   OpenAI API    │
│  (PostgreSQL)   │  │ (Form Autofill) │  │  (Doc Vision)   │
│  (Auth)         │  │                 │  │                 │
│  (Storage)      │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Why this stack?**

- **Next.js 16 + App Router**: Server components by default = faster page loads, better SEO, simpler data fetching
- **Supabase**: PostgreSQL + Auth + Storage in one. Row Level Security (RLS) means the database itself enforces access rules
- **Claude + OpenAI**: Claude is better at reasoning (form filling), OpenAI Vision is better at reading images (documents)
- **shadcn/ui**: Not a component library you `npm install` - it's copy-paste components you own and customize

### Key Directories

```
src/
├── app/                    # Pages and API routes (Next.js App Router)
│   ├── (auth)/            # Login, register, etc. (route group)
│   ├── dashboard/         # Main app after login
│   └── api/               # Backend API routes
├── components/            # React components
│   ├── ui/                # shadcn/ui primitives - DON'T EDIT
│   ├── layout/            # Sidebar, Header, etc.
│   └── [feature]/         # Feature-specific (forms, documents, etc.)
├── lib/                   # Business logic and utilities
│   ├── ai/                # AI integration (Claude, OpenAI)
│   ├── supabase/          # Database client setup
│   ├── rbac/              # Role-based access control
│   ├── pdf/               # PDF generation
│   └── ...
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript type definitions
```

---

## How the AI Magic Works

### Document Analysis Flow

```
User uploads passport
        │
        ▼
┌───────────────────┐
│  File Validation  │ ← Magic bytes check, virus scan
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Upload to        │ ← Supabase Storage (documents bucket)
│  Supabase         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  OpenAI Vision    │ ← "Read this passport and extract..."
│  gpt-4o           │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Store Extracted  │ ← ai_extracted_data JSON column
│  Data in DB       │
└───────────────────┘
```

### Form Autofill Flow

```
Attorney clicks "AI Autofill"
        │
        ▼
┌───────────────────┐
│  Gather All       │ ← All documents for this case
│  Case Documents   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Claude Sonnet    │ ← "Fill this I-130 form using this data..."
│                   │   (with form schema + extracted data)
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Store AI Data    │ ← ai_filled_data + ai_confidence_scores
│  + Confidence     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Attorney Review  │ ← Low confidence fields flagged
│  Required         │
└───────────────────┘
```

**Why two AI models?**
- OpenAI Vision is better at OCR and reading complex documents
- Claude is better at reasoning, understanding form requirements, and generating consistent structured output

---

## Security Architecture

Immigration data is **extremely sensitive** (PII, SSNs, passport numbers). We take security seriously:

### 1. Row Level Security (RLS)

Supabase enforces that users can only access their own data at the database level:

```sql
-- Example: Users can only see their own cases
CREATE POLICY "Users can view own cases" ON cases
  FOR SELECT
  USING (
    auth.uid() = attorney_id OR
    auth.uid() = client_id
  );
```

This means even if there's a bug in our code, the database won't return unauthorized data.

### 2. File Validation

Before accepting uploads, we:
1. Check **magic bytes** - Is this actually a PDF or someone renamed a .exe?
2. Scan for **viruses** - ClamAV or VirusTotal integration
3. Validate **file size** - No 500MB uploads crashing our servers

See `/src/lib/file-validation/index.ts`

### 3. AI Confidence Thresholds

AI can make mistakes. For critical fields (SSN, alien numbers):
- We require **80%+ confidence** or attorney review
- Certain fields are **mandatory review** regardless of confidence
- Forms can't be filed until low-confidence fields are reviewed

See `/src/lib/form-validation/index.ts`

### 4. Rate Limiting

Using Upstash Redis for distributed rate limiting:
- Prevents API abuse
- **Fails closed** in production - if Redis is down, requests are rejected
- No silent in-memory fallback that would fail with multiple server instances

See `/src/lib/rate-limit/index.ts`

### 5. Frontend RBAC

Three user roles: `attorney`, `client`, `admin`
- **Attorneys** can manage cases, clients, and forms
- **Clients** can view their own cases and upload documents
- **Admins** can access system administration

Route protection happens at multiple layers:
1. **Middleware** - Server-side, before page loads
2. **Page level** - `useRoleGuard()` hook
3. **Component level** - `<RoleOnly>` wrapper

See `/src/lib/rbac/index.ts`

---

## Lessons Learned (The Hard Way)

### 1. Always Check Actual File Content

**The Bug:** Someone could rename `malware.exe` to `document.pdf` and upload it.

**The Fix:** Magic byte validation. First few bytes of a file tell you what it really is:
- PDF starts with `%PDF`
- JPEG starts with `FF D8 FF`
- PNG starts with `89 50 4E 47`

### 2. AI Confidence Isn't Enough

**The Bug:** AI was 75% confident about an SSN but filled it anyway. Wrong SSN = rejected application.

**The Fix:** Mandatory review for sensitive fields. Even if AI is 99% confident, attorney must verify SSN, alien number, etc.

### 3. In-Memory Fallbacks Are Dangerous

**The Bug:** Rate limiting used in-memory storage as fallback. Works fine locally, fails with multiple servers (each has its own memory).

**The Fix:** Fail-closed pattern. If Redis isn't configured in production, reject requests rather than silently using broken in-memory storage.

### 4. Timeouts Prevent Hanging UIs

**The Bug:** AI processing could take 2+ minutes. Users thought the app was frozen.

**The Fix:** Proper timeouts with user feedback:
- Standard API: 30 seconds
- File uploads: 60 seconds
- AI processing: 2 minutes
- Show loading states with progress

---

## Patterns You'll See Everywhere

### Data Fetching with TanStack Query

```typescript
// In hooks/use-cases.ts
export function useCases(filters?: CaseFilters) {
  return useQuery({
    queryKey: ['cases', filters],
    queryFn: () => fetchCases(filters),
  });
}

// In a component
function CasesList() {
  const { data, isLoading, error } = useCases({ status: 'active' });
  // React Query handles caching, refetching, error states
}
```

**Why?** TanStack Query handles all the hard stuff: caching, background refetching, optimistic updates, error retry.

### Form Handling with React Hook Form + Zod

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { email: '', password: '' },
});

// Now form validation is type-safe and declarative
```

**Why?** Zod gives you runtime validation + TypeScript types from a single schema. React Hook Form is performant (no re-renders on every keystroke).

### Role-Based UI

```typescript
// Show button only to attorneys and admins
<RoleOnly roles={['attorney', 'admin']}>
  <Button onClick={handleCreate}>Create Case</Button>
</RoleOnly>

// Protect entire page
function ClientsPage() {
  useRoleGuard({ requiredRoles: ['attorney', 'admin'] });
  // If not authorized, automatically redirects
}
```

---

## Testing Strategy

### Unit Tests (Vitest)
- Located in `*.test.ts` files next to source
- Coverage at ~86%
- Run with `npm test`

### E2E Tests (Playwright)
- Located in `tests/e2e/`
- Test real user flows (login, create case, upload doc)
- Run with `npm run test:e2e`

### Key Test Files

```
tests/
├── e2e/
│   ├── auth.spec.ts      # Login, register, logout
│   ├── cases.spec.ts     # Case CRUD
│   ├── documents.spec.ts # Document upload, analysis
│   ├── billing.spec.ts   # Subscription flows
│   └── firms.spec.ts     # Multi-tenant features
└── ...
```

---

## AI-Native Features (New in 2026-01-27)

We transformed the app from "AI-powered" (just document + form filling) to **truly AI-native** with 6 integrated features:

### 1. Document Completeness Analysis
```
GET /api/cases/[id]/completeness

Response: {
  overallCompleteness: 75,  // 0-100%
  filingReadiness: 'needs_review',
  missingRequired: ['marriage_certificate', 'i94'],
  uploadedDocs: [{ type: 'passport', quality: 0.95 }]
}
```
- Shows progress ring on case detail page
- Compares uploaded docs against visa type requirements
- "Filing Ready" status when complete

### 2. Success Probability Scoring
**Rule-based algorithm** (no AI calls, fast and predictable):

| Factor | Weight |
|--------|--------|
| Document Completeness | 30% |
| Document Quality | 15% |
| Form Field Confidence | 20% |
| Field Validation | 15% |
| Timeline | 10% |
| Historical | 10% |

Color-coded badge: green (70+), yellow (40-69), red (<40)

### 3. AI Recommendations (Next Steps)
Uses existing `suggestNextSteps()` from Claude to suggest prioritized actions:
- "Upload Employment Verification Letter (Required for I-485)"
- Caches for 1 hour, invalidates on case changes
- Complete/dismiss actions

### 4. Predictive Deadline Alerts
Daily cron job (`/api/cron/deadline-alerts`) scans for:
- Case deadlines approaching
- Document expirations
- Processing time estimates

Severity levels: Critical (<7 days), Warning (7-30 days), Info (30-60 days)

### 5. Natural Language Case Search
```
POST /api/cases/search
Body: { query: "H1B cases with missing I-94" }

Claude parses to:
{
  filters: { visaType: ['H1B'], documentMissing: ['i94'] },
  understood: "Find H1B cases missing I-94 document"
}
```
AI toggle in header search to switch between exact and semantic search.

### 6. AI Chat Assistant
Streaming chat with case context:
- Floating button (bottom-right of dashboard)
- Knows the current case when opened from case detail
- Tool calls for: get_case_details, get_documents, get_completeness, search_cases
- Conversation persistence in database

### Architecture Decisions

**Why Claude for chat/recommendations?** Claude is better at reasoning and context.

**Why rule-based for success scoring?**
- Predictable (no hallucinations)
- Fast (no API calls)
- Explainable (factors shown to user)

**Why query parsing instead of vector search?**
- No infrastructure changes (no vector DB)
- Works well for structured data (visa types, dates)
- Cheaper for low-to-medium volume

---

## What's Still Missing (Tech Debt)

1. ~~**Stripe Billing** - No monetization yet~~ (Added in Phase 2)
2. ~~**Multi-Tenancy** - Firms/organizations for team accounts~~ (Added in Phase 2)
3. **Email Notifications** - No deadline reminders (deadline alerts exist but no email)
4. **Accessibility** - WCAG 2.1 compliance incomplete
5. **i18n** - Spanish translation needed for immigration context
6. **Real USCIS PDFs** - Currently generates summary PDFs, not fillable forms

---

## Quick Reference

### Running Locally

```bash
npm install
cp .env.example .env.local  # Fill in your values
npm run dev                 # http://localhost:3000
```

### Building for Production

```bash
npm run build               # TypeScript check + build
npm run start               # Run production server
```

### Running Tests

```bash
npm test                    # Unit tests
npm run test:e2e            # E2E tests
npm run test:coverage       # Coverage report
```

### Key Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# Production
UPSTASH_REDIS_REST_URL=...
SENTRY_DSN=...
```

---

## Good Engineering Patterns in This Codebase

1. **Fail-Closed Security** - When in doubt, deny access
2. **Defense in Depth** - RLS + middleware + component guards
3. **Audit Everything** - Form changes, downloads, reviews all logged
4. **Type Everything** - No `any` types, Zod for runtime validation
5. **Error Boundaries** - Graceful degradation, not white screens
6. **Request Timeouts** - No infinite hanging requests

---

## Bugs We Fixed and What We Learned (2026-01-30)

### The Auth Loading Bug

**Symptom**: Users would see an infinite spinner when navigating directly to dashboard pages (bookmarks, refresh, etc.)

**Root Cause**: Multiple race conditions:
1. `use-auth.ts` and `auth-provider.tsx` both called `getSession()` separately
2. `use-user.ts` had a 10-second timeout but if auth failed silently, loading never resolved
3. No fallback if auth took too long

**Fix**: Added a master timeout in `dashboard-layout.tsx`:
```typescript
useEffect(() => {
  if (!isLoading) return;

  const timeout = setTimeout(() => {
    setTimedOut(true);  // Show "try again" UI
  }, 5000);

  return () => {
    clearTimeout(timeout);
    setTimedOut(false);  // Reset on cleanup
  };
}, [isLoading]);
```

**Lesson**: Always have a timeout fallback for auth. Users would rather see "try again" than infinite spinner.

### The 401 API Error Bug

**Symptom**: After page refresh, API calls would fail with 401 even though user was logged in.

**Root Cause**: `credentials: 'include'` was missing from fetch calls. Browser doesn't send cookies by default for fetch requests!

**Fix**: One-liner in `fetch-with-timeout.ts`:
```typescript
const response = await fetch(url, {
  ...options,
  credentials: 'include',  // <-- This was missing!
  signal: controller.signal,
});
```

**Lesson**: If you're using cookies for auth and API calls fail after refresh, check `credentials: 'include'`.

### The Test Mock Problem

**Symptom**: 89 tests failing with "No 'standardRateLimiter' export defined on mock"

**Root Cause**: When you `vi.mock('@/lib/rate-limit')`, you must export **everything** the module exports. If code imports `standardRateLimiter` and the mock doesn't have it, test fails.

**Fix**: Complete the mock with all exports:
```typescript
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { ... },
  standardRateLimiter: { limit: vi.fn().mockResolvedValue({ allowed: true }) },
  aiRateLimiter: { ... },
  authRateLimiter: { ... },
  // ... all other exports
}));
```

**Lesson**: Incomplete mocks cause confusing runtime errors. Always check what the real module exports.

---

*Last updated: 2026-01-30 after Critical Bug Fixes*
