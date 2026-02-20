# Backend Integration Plan: CaseFill

> Production-ready plan for adding a worker service to handle long-running operations.

## Decision: Hybrid Architecture

**NOT a full backend separation.** After analyzing all 76+ API routes, the right architecture is:

- **Keep in Next.js**: All CRUD routes, auth, Stripe webhooks, quick queries (65+ routes)
- **Move to Worker Service**: AI processing, email, cron jobs, PDF coordination (11 routes worth of logic)
- **Communication**: Redis (BullMQ) job queue between Next.js and the worker

### Why Hybrid, Not Full Separation

| Factor | Full Separation | Hybrid (Chosen) |
|--------|----------------|-----------------|
| Auth | Must re-implement or proxy JWT | Supabase cookies stay as-is for CRUD |
| Migration effort | 3-4 weeks (rewrite 76+ routes) | 1-2 weeks (extract 11 routes of logic) |
| Risk | High (everything changes at once) | Low (CRUD routes untouched) |
| Latency | Extra hop for every request | Extra hop only for async jobs |
| Complexity | Two full API surfaces | One API surface + internal job queue |
| RLS | Must use service_role key everywhere | CRUD keeps user-scoped RLS |

### Why Not "Just Add Inngest/Trigger.dev"

Third-party job orchestrators are an option, but:
- They add vendor lock-in for your core AI pipeline
- Pricing scales with job volume (AI calls are expensive enough)
- You already have Upstash Redis -- BullMQ is free, open-source, and battle-tested
- A dedicated worker gives you full control over retries, circuit breakers, and monitoring

---

## Architecture Overview

```
                    PRODUCTION ARCHITECTURE

Users ──► Vercel (Next.js 16)
          │
          ├── React UI (Client Components)
          ├── 65+ CRUD API Routes (unchanged)
          │   ├── /api/cases/*
          │   ├── /api/clients/*
          │   ├── /api/tasks/*
          │   ├── /api/billing/webhooks (Stripe)
          │   ├── /api/auth/*
          │   └── etc.
          │
          ├── Job Submission Routes (NEW - thin proxies)
          │   ├── POST /api/documents/[id]/analyze  → enqueue job
          │   ├── POST /api/forms/[id]/autofill      → enqueue job
          │   ├── POST /api/chat                     → keep SSE (special case)
          │   └── GET  /api/jobs/[id]/status          → poll job status
          │
          └── Supabase Realtime (optional push)
                    │
                    ▼
              Upstash Redis
              (BullMQ Queues)
                    │
                    ▼
          Railway Worker Service (Node.js)
          │
          ├── AI Workers
          │   ├── document-analysis (OpenAI Vision)
          │   ├── form-autofill (Anthropic Claude)
          │   ├── recommendations (Anthropic Claude)
          │   ├── completeness-check (Anthropic Claude)
          │   └── success-score (Anthropic Claude)
          │
          ├── Utility Workers
          │   ├── email-sender (Resend)
          │   ├── pdf-coordinator (calls Railway PDF service)
          │   └── virus-scanner (ClamAV/VirusTotal)
          │
          ├── Cron Scheduler (node-cron or BullMQ repeatable)
          │   ├── deadline-alerts (daily 6 AM)
          │   ├── cleanup (daily midnight)
          │   └── audit-archive (weekly Sunday 3 AM)
          │
          └── Monitoring
              ├── Bull Board UI (queue dashboard)
              ├── Health endpoint (/health)
              └── Sentry error tracking
```

---

## Tech Stack Decision

### Worker Service: Node.js + BullMQ on Railway

**Why Node.js (not Python/FastAPI)?**
- Same language as Next.js = shared types, shared `src/lib/` code
- Your AI logic is already TypeScript (`src/lib/ai/anthropic.ts`, `src/lib/ai/openai.ts`)
- Monorepo: worker imports from `src/lib/` directly (no code duplication)
- Team doesn't need to context-switch languages

**Why BullMQ (not SQS/Celery/Temporal)?**
- You already pay for Upstash Redis
- BullMQ is free, open-source, 14k GitHub stars
- First-class TypeScript support
- Built-in: retries, backoff, rate limiting, priority queues, repeatable jobs
- Bull Board gives you a free monitoring dashboard
- No vendor lock-in

**Why Railway (not Fly.io/Render)?**
- You already deploy the PDF service on Railway
- One platform = one billing dashboard
- Native Docker support
- Persistent processes (not serverless -- workers stay alive)
- Sleep-on-idle available for cost savings in early stage

---

## What Moves to the Worker (and What Doesn't)

### MOVES: Long-Running / Async Operations

| Current Route | Worker Queue | Why |
|--------------|-------------|-----|
| `POST /api/documents/[id]/analyze` | `ai:document-analysis` | 30-60s OpenAI Vision call |
| `POST /api/forms/[id]/autofill` | `ai:form-autofill` | 10-30s Claude reasoning |
| `GET /api/cases/[id]/recommendations` | `ai:recommendations` | AI analysis, cacheable |
| `GET /api/cases/[id]/completeness` | `ai:completeness` | AI analysis, cacheable |
| `GET /api/cases/[id]/success-score` | `ai:success-score` | AI analysis, cacheable |
| `GET /api/cases/search` | `ai:natural-search` | AI-powered semantic search |
| `sendEmail()` calls | `util:email` | Should never block API response |
| `GET /api/cron/deadline-alerts` | BullMQ repeatable | No more Vercel cron limits |
| `GET /api/cron/cleanup` | BullMQ repeatable | Runs reliably, retries on failure |
| `GET /api/cron/audit-archive` | BullMQ repeatable | Runs reliably, retries on failure |
| Virus scanning (during upload) | `util:virus-scan` | Currently blocks upload response |

### STAYS: Synchronous CRUD + Auth

| Route Group | Why It Stays |
|------------|-------------|
| `/api/auth/*` | Cookie-based, must be same-origin |
| `/api/cases/*` (CRUD) | Fast DB queries (<200ms), RLS-protected |
| `/api/clients/*` | Simple CRUD |
| `/api/tasks/*` | Simple CRUD |
| `/api/forms/*` (CRUD, review) | Fast DB queries |
| `/api/documents/*` (CRUD, verify) | Fast DB queries |
| `/api/billing/*` | Stripe webhooks must respond quickly |
| `/api/notifications/*` | Simple CRUD |
| `/api/2fa/*` | Security-critical, must be same-origin |
| `/api/profile/*` | Simple CRUD |
| `/api/admin/*` | Simple CRUD |
| `/api/firms/*` | Simple CRUD |
| `/api/gdpr/*` | Could move later, low priority |
| `/api/health` | Must stay for Vercel health checks |

### SPECIAL CASE: Chat (SSE Streaming)

Chat stays in Next.js because:
- It uses Server-Sent Events (streaming), which is inherently real-time
- The keepalive pattern already works within Vercel's timeout
- Moving it to the worker would require WebSocket infrastructure
- If chat becomes a problem later, add a dedicated WebSocket service

---

## Project Structure

```
immigration-ai/
├── src/                          # Next.js app (unchanged structure)
│   ├── app/api/                  # CRUD routes stay here
│   └── lib/
│       ├── ai/                   # Shared AI logic (used by worker too)
│       ├── db/                   # Shared DB services
│       ├── email/                # Shared email logic
│       └── jobs/                 # NEW: Job client (enqueue from Next.js)
│           ├── client.ts         # BullMQ connection + queue references
│           ├── queues.ts         # Queue definitions and types
│           └── types.ts          # Shared job payload types
│
├── services/
│   ├── pdf-service/              # Existing Railway service (unchanged)
│   │
│   └── worker/                   # NEW: Background worker service
│       ├── Dockerfile
│       ├── railway.toml
│       ├── package.json          # Minimal deps (imports from root src/lib/)
│       ├── tsconfig.json         # Extends root tsconfig with path aliases
│       ├── src/
│       │   ├── index.ts          # Worker entry point (starts all workers)
│       │   ├── config.ts         # Worker-specific env validation
│       │   ├── health.ts         # Express health endpoint + Bull Board
│       │   ├── workers/
│       │   │   ├── document-analysis.ts
│       │   │   ├── form-autofill.ts
│       │   │   ├── recommendations.ts
│       │   │   ├── completeness.ts
│       │   │   ├── success-score.ts
│       │   │   ├── natural-search.ts
│       │   │   ├── email-sender.ts
│       │   │   ├── virus-scanner.ts
│       │   │   └── pdf-coordinator.ts
│       │   ├── scheduler/
│       │   │   └── cron-jobs.ts   # BullMQ repeatable jobs
│       │   └── middleware/
│       │       ├── circuit-breaker.ts
│       │       ├── retry-strategy.ts
│       │       └── telemetry.ts
│       └── tests/
│           └── workers/           # Worker unit tests
```

### Key Design: Shared Code via Monorepo

The worker **imports directly from `src/lib/`** -- no code duplication:

```typescript
// services/worker/src/workers/document-analysis.ts
import { analyzeDocumentWithVision } from '@/lib/ai/openai';
import { createServiceClient } from '@/lib/supabase/admin';
```

This works because:
1. Worker's `tsconfig.json` extends root config with same path aliases
2. Worker's Dockerfile copies both `services/worker/` and `src/lib/`
3. Shared code uses Supabase service_role key (not cookie auth)

---

## Implementation Phases

### Phase 1: Foundation (3-4 days)

**Goal**: Worker service running on Railway, connected to Redis, processing one queue.

#### 1.1 Set up BullMQ infrastructure

Create `src/lib/jobs/client.ts`:
```typescript
import { Queue } from 'bullmq';

const connection = {
  host: process.env.UPSTASH_REDIS_REST_URL,
  // Upstash requires TLS + token auth
};

export const documentAnalysisQueue = new Queue('ai:document-analysis', { connection });
export const formAutofillQueue = new Queue('ai:form-autofill', { connection });
export const emailQueue = new Queue('util:email', { connection });
// ... etc
```

Create `src/lib/jobs/types.ts`:
```typescript
export interface DocumentAnalysisJob {
  documentId: string;
  userId: string;
  signedUrl: string;
  documentType: string;
}

export interface FormAutofillJob {
  formId: string;
  userId: string;
  caseId: string;
}

export interface EmailJob {
  to: string | string[];
  subject: string;
  templateName: string;
  templateData: Record<string, unknown>;
  userId?: string;
}

export interface JobStatusResponse {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
}
```

#### 1.2 Create worker service scaffold

`services/worker/src/index.ts`:
```typescript
import { Worker } from 'bullmq';
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Start workers
const documentWorker = new Worker('ai:document-analysis', processDocumentAnalysis, {
  connection,
  concurrency: 3,  // Process 3 documents simultaneously
  limiter: { max: 10, duration: 60_000 },  // Max 10/minute (OpenAI rate limit)
});

// Health + monitoring
const app = express();
app.get('/health', (req, res) => res.json({ status: 'healthy', workers: getWorkerStats() }));

// Bull Board dashboard (password-protected in production)
const serverAdapter = new ExpressAdapter();
createBullBoard({ queues: [new BullMQAdapter(documentAnalysisQueue)] });
app.use('/admin/queues', serverAdapter.getRouter());

app.listen(process.env.PORT || 3001);
```

#### 1.3 Deploy to Railway

`services/worker/Dockerfile`:
```dockerfile
FROM node:20-slim
WORKDIR /app

# Copy shared library code
COPY src/lib/ src/lib/
COPY services/worker/ services/worker/

# Install worker dependencies
WORKDIR /app/services/worker
RUN npm ci --production

CMD ["node", "dist/index.js"]
```

`services/worker/railway.toml`:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

#### 1.4 Add job status API route

`src/app/api/jobs/[id]/status/route.ts`:
```typescript
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const job = await findJobById(id);  // Check all queues

  return NextResponse.json({
    id: job.id,
    status: await job.getState(),
    progress: job.progress,
    result: job.returnvalue,
    error: job.failedReason,
  });
}
```

### Phase 2: Migrate AI Operations (3-4 days)

**Goal**: All 6 AI endpoints use the job queue instead of synchronous processing.

#### 2.1 Migrate Document Analysis

**Before** (`src/app/api/documents/[id]/analyze/route.ts`):
```typescript
// Currently: Synchronous, blocks for 30-60 seconds
const result = await analyzeDocumentWithVision({ imageUrl, documentType });
await updateDocumentStatus(documentId, 'analyzed', result);
return NextResponse.json({ result });
```

**After**:
```typescript
// New: Enqueue job, return immediately
const job = await documentAnalysisQueue.add('analyze', {
  documentId,
  userId: auth.user.id,
  signedUrl,
  documentType,
});

return NextResponse.json({
  jobId: job.id,
  status: 'processing',
  message: 'Document analysis started. You will be notified when complete.',
});
```

**Worker** (`services/worker/src/workers/document-analysis.ts`):
```typescript
async function processDocumentAnalysis(job: Job<DocumentAnalysisJob>) {
  const { documentId, userId, signedUrl, documentType } = job.data;
  const supabase = createServiceClient();  // Service role, not user cookies

  try {
    job.updateProgress(10);

    // Call OpenAI (no timeout limit -- worker runs indefinitely)
    const result = await analyzeDocumentWithVision({ imageUrl: signedUrl, documentType });
    job.updateProgress(80);

    // Update document in DB
    await supabase.from('documents').update({
      status: result.confidence >= 50 ? 'analyzed' : 'needs_review',
      ai_extracted_data: result.extractedData,
      ai_confidence_score: result.confidence,
    }).eq('id', documentId);

    // Track usage
    await trackUsage(userId, 'ai_requests');
    job.updateProgress(100);

    // Create notification for user
    await createNotification(supabase, userId, {
      type: 'document_analyzed',
      title: 'Document analysis complete',
      message: `Your document has been analyzed with ${result.confidence}% confidence.`,
      link: `/dashboard/cases/${caseId}/documents`,
    });

    return { success: true, confidence: result.confidence };
  } catch (error) {
    // Revert document status on failure
    await supabase.from('documents').update({ status: 'uploaded' }).eq('id', documentId);
    throw error;  // BullMQ will retry based on config
  }
}
```

#### 2.2 Migrate Form Autofill

Same pattern: API route enqueues, worker processes, updates DB, sends notification.

Key difference: Form autofill uses advisory locks. The worker must:
1. Call `try_start_form_autofill` RPC before processing
2. Call `cancel_form_autofill` RPC on failure
3. Update form status atomically on success

#### 2.3 Migrate Recommendations, Completeness, Success Score

These three are simpler because they're read-only (don't modify DB state).

Pattern:
1. API route checks cache first (recommendations cache in DB)
2. If cache miss, enqueue job
3. Worker computes result, stores in cache table
4. Frontend polls for result OR gets push via Supabase Realtime

#### 2.4 Frontend Changes

Update hooks to handle async job pattern:

```typescript
// src/hooks/use-documents.ts
export function useAnalyzeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetchWithTimeout(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
      });
      return parseApiResponse<{ jobId: string; status: string }>(response);
    },
    onSuccess: (data, documentId) => {
      // Optimistically update document status to 'processing'
      queryClient.setQueryData(['document', documentId], (old: any) => ({
        ...old,
        status: 'processing',
        jobId: data.jobId,
      }));

      // Start polling for job completion
      startJobPolling(data.jobId, () => {
        queryClient.invalidateQueries({ queryKey: ['document', documentId] });
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      });
    },
  });
}
```

Job polling utility:
```typescript
// src/lib/jobs/polling.ts
export function startJobPolling(jobId: string, onComplete: () => void) {
  const interval = setInterval(async () => {
    const response = await fetchWithTimeout(`/api/jobs/${jobId}/status`, { timeout: 'QUICK' });
    const status = await parseApiResponse<JobStatusResponse>(response);

    if (status.status === 'completed') {
      clearInterval(interval);
      onComplete();
    } else if (status.status === 'failed') {
      clearInterval(interval);
      toast.error(status.error || 'Processing failed. Please try again.');
    }
  }, 3000);  // Poll every 3 seconds

  // Auto-cleanup after 5 minutes
  setTimeout(() => clearInterval(interval), 5 * 60 * 1000);

  return () => clearInterval(interval);
}
```

### Phase 3: Email, Cron, and Utilities (2-3 days)

#### 3.1 Email Queue

Replace synchronous `sendEmail()` with queue enqueue:

```typescript
// src/lib/email/index.ts (modified)
export async function sendEmail(options: SendEmailOptions, userId?: string) {
  // Log immediately
  const emailLog = await createEmailLog(options, userId);

  // Enqueue instead of sending directly
  await emailQueue.add('send', {
    ...options,
    emailLogId: emailLog.id,
    userId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });

  return { success: true, queued: true };
}
```

Worker processes email with retries automatically.

#### 3.2 Replace Vercel Cron with BullMQ Repeatable Jobs

```typescript
// services/worker/src/scheduler/cron-jobs.ts
import { Queue } from 'bullmq';

const cronQueue = new Queue('cron', { connection });

// Deadline alerts - daily at 6 AM UTC
await cronQueue.add('deadline-alerts', {}, {
  repeat: { pattern: '0 6 * * *' },
  removeOnComplete: 100,
  removeOnFail: 50,
});

// Cleanup - daily at midnight
await cronQueue.add('cleanup', {}, {
  repeat: { pattern: '0 0 * * *' },
});

// Audit archive - Sunday 3 AM
await cronQueue.add('audit-archive', {}, {
  repeat: { pattern: '0 3 * * 0' },
});
```

Remove the `crons` section from `vercel.json` and the `/api/cron/*` routes.

#### 3.3 Virus Scanning (async during upload)

Current: Upload blocks while virus scan runs.
After: Upload completes immediately with status "scanning", worker scans async.

### Phase 4: Reliability & Monitoring (2-3 days)

#### 4.1 Circuit Breaker for AI Providers

```typescript
// services/worker/src/middleware/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailure: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,      // Open after 5 failures
    private resetTimeout: number = 60_000  // Try again after 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure!.getTime() > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - AI provider is down');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}

export const openaiBreaker = new CircuitBreaker(5, 60_000);
export const anthropicBreaker = new CircuitBreaker(5, 60_000);
```

#### 4.2 Retry Strategy

```typescript
// Per-queue retry configuration
const AI_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10_000,  // 10s, 20s, 40s
  },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
};

const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5_000,  // 5s, 10s, 20s, 40s, 80s
  },
};
```

#### 4.3 Bull Board Dashboard

Expose at `https://worker.railway.app/admin/queues` with basic auth:

```typescript
app.use('/admin/queues',
  basicAuth({ users: { admin: process.env.BULL_BOARD_PASSWORD } }),
  serverAdapter.getRouter()
);
```

#### 4.4 Sentry Integration

```typescript
import * as Sentry from '@sentry/node';

worker.on('failed', (job, error) => {
  Sentry.captureException(error, {
    tags: { queue: job.queueName, jobId: job.id },
    extra: { data: job.data, attemptsMade: job.attemptsMade },
  });
});
```

---

## Auth Strategy for the Worker

The worker does NOT handle user authentication. It uses the Supabase service_role key:

```typescript
// services/worker/src/supabase.ts
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // Bypasses RLS
  );
}
```

**Security model**:
1. Next.js validates user auth + permissions (as it does today)
2. Next.js enqueues job with `userId` in payload
3. Worker trusts the `userId` because only Next.js can enqueue
4. Worker uses service_role to bypass RLS (it's an internal service)
5. Redis connection is authenticated (Upstash TLS + token)

This is the same pattern your PDF service already uses (bearer token auth between services).

---

## Database Changes

### New table: `job_status`

```sql
CREATE TABLE job_status (
  id TEXT PRIMARY KEY,              -- BullMQ job ID
  queue_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT,                 -- 'document', 'form', 'case'
  entity_id UUID,                   -- Reference to the entity
  status TEXT NOT NULL DEFAULT 'queued',  -- queued, active, completed, failed
  progress INTEGER DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0
);

-- RLS: Users can only see their own jobs
ALTER TABLE job_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own jobs" ON job_status
  FOR SELECT USING (auth.uid() = user_id);

-- Index for polling
CREATE INDEX idx_job_status_user_pending
  ON job_status(user_id, status)
  WHERE status IN ('queued', 'active');
```

This lets the frontend poll job status via Supabase directly (no API route needed for reads).

---

## Environment Variables (New)

### Next.js (Vercel) - Add:
```
# Already have UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
# BullMQ uses the same Redis instance
WORKER_SERVICE_URL=https://worker-production.up.railway.app  # For health checks
```

### Worker Service (Railway) - Set:
```
# Database
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# AI
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

# Redis (BullMQ)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Email
RESEND_API_KEY=...

# PDF Service
PDF_SERVICE_URL=...
PDF_SERVICE_SECRET=...

# Monitoring
SENTRY_DSN=...
BULL_BOARD_PASSWORD=...

# Virus Scanner
VIRUS_SCANNER_PROVIDER=...
CLAMAV_API_URL=...

# Worker Config
NODE_ENV=production
PORT=3001
WORKER_CONCURRENCY=5
```

---

## Migration Strategy (Zero Downtime)

### Step 1: Deploy worker with queues (no routes changed yet)
- Worker connects to Redis, starts processing
- No jobs are enqueued yet
- Verify health endpoint works

### Step 2: Add job submission behind feature flag
```typescript
const USE_WORKER = process.env.WORKER_ENABLED === 'true';

// In /api/documents/[id]/analyze/route.ts
if (USE_WORKER) {
  // New: enqueue job
  const job = await documentAnalysisQueue.add('analyze', payload);
  return NextResponse.json({ jobId: job.id, status: 'processing' });
} else {
  // Old: synchronous processing (existing code)
  const result = await analyzeDocumentWithVision(payload);
  return NextResponse.json({ result });
}
```

### Step 3: Enable for internal testing
Set `WORKER_ENABLED=true` on staging. Test all flows.

### Step 4: Enable in production
Flip `WORKER_ENABLED=true` in Vercel production env vars.

### Step 5: Remove old synchronous code
Once stable (1-2 weeks), remove the feature flag and old code paths.

---

## Cost Estimate

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway Worker | Hobby | $5 base + usage (~$10-20) |
| Upstash Redis | Pro (already have) | $0 incremental |
| Railway PDF Service | Already running | $0 incremental |
| Total incremental | | **~$15-25/month** |

At scale (1000+ users), Railway's Team plan ($20/seat + usage) provides more resources.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Redis goes down | BullMQ has connection retry. Jobs are durable in Redis. Upstash has 99.99% SLA. |
| Worker crashes | Railway auto-restarts (ON_FAILURE policy). Jobs remain in Redis queue. |
| AI provider outage | Circuit breaker stops hammering. Jobs retry with exponential backoff. |
| Job stuck forever | BullMQ `stalledInterval` detects stuck jobs. Auto-retry after 30s stall. |
| Supabase connection limit | Worker uses single persistent connection (not per-request like serverless). |
| Signed URL expires before worker processes | Generate signed URL in worker, not in Next.js. Worker generates just-in-time. |
| Data inconsistency | Worker updates DB atomically. Failed jobs revert state. Advisory locks prevent races. |

---

## Success Criteria

Before considering this complete:

- [ ] Worker processes document analysis reliably (0% timeout rate)
- [ ] Worker processes form autofill reliably
- [ ] Email delivery is queued (never blocks API response)
- [ ] Cron jobs run via BullMQ repeatable (Vercel cron removed)
- [ ] Bull Board dashboard accessible and password-protected
- [ ] Circuit breaker trips when AI provider is down
- [ ] Failed jobs retry with exponential backoff
- [ ] Frontend shows "processing..." state with progress polling
- [ ] Job status table has RLS policies
- [ ] Worker health endpoint returns queue stats
- [ ] Sentry captures worker errors with job context
- [ ] Zero downtime migration via feature flag
- [ ] Load test: 20 concurrent AI jobs complete without issues

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1**: Foundation | 3-4 days | Worker on Railway, BullMQ connected, 1 queue working |
| **Phase 2**: AI Migration | 3-4 days | All 6 AI endpoints async, frontend polling |
| **Phase 3**: Email/Cron/Util | 2-3 days | Email queued, cron replaced, virus scan async |
| **Phase 4**: Reliability | 2-3 days | Circuit breaker, monitoring, load testing |
| **Total** | **~2 weeks** | Production-ready hybrid architecture |
