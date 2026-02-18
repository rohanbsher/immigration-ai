# Session: 2026-02-18 — Backend Worker Service Phase 1

## Summary

Implemented Phase 1 (Foundation) of the Backend Integration Plan. Created the complete BullMQ worker service infrastructure — connection layer, job types, queue definitions, worker service scaffold, deployment config, job status API, database migration, and frontend polling utility.

## Context

The application is a Next.js 16 monolith on Vercel with 85+ API routes. All AI processing is synchronous, hitting Vercel's 60s timeout ceiling. A comprehensive architecture analysis determined a **hybrid approach**: keep CRUD routes in Next.js, move 11 long-running operations (AI processing, email, cron) to a BullMQ worker on Railway.

The full plan is documented in `docs/BACKEND_INTEGRATION_PLAN.md` (864 lines).

## What I Did

### Phase 1: Foundation — COMPLETE (all 9 tasks)

| # | Task | Status |
|---|------|--------|
| 1 | Create `feat/worker-service` branch + install `bullmq` | DONE |
| 2 | Add `REDIS_URL` + `WORKER_ENABLED` to env config | DONE |
| 3 | Create BullMQ connection, types, and queue definitions | DONE |
| 4 | Create worker service scaffold (config, health, index) | DONE |
| 5 | Create Dockerfile + railway.toml for Railway deployment | DONE |
| 6 | Create job status API route (`/api/jobs/[id]/status`) | DONE |
| 7 | Create `job_status` database migration (#054) | DONE |
| 8 | Create frontend job polling utility | DONE |
| 9 | Verify build passes (Next.js + worker) | DONE |

### Files Created (14 new files)

| File | Purpose |
|------|---------|
| `src/lib/jobs/connection.ts` | BullMQ Redis connection config (parses `REDIS_URL`, not REST URL) |
| `src/lib/jobs/types.ts` | Job payload interfaces, queue name constants, default job options |
| `src/lib/jobs/queues.ts` | Lazy-initialized typed queue instances + enqueue helpers |
| `src/lib/jobs/polling.ts` | Frontend job polling utility (3s interval, 5min max, callbacks) |
| `src/app/api/jobs/[id]/status/route.ts` | Job status polling API (auth + rate limited, searches all queues) |
| `services/worker/package.json` | Worker deps: bullmq, express, bull-board, ioredis, zod |
| `services/worker/tsconfig.json` | TS config with `rootDir: "../.."` for shared `@/lib/*` imports |
| `services/worker/src/config.ts` | Zod-validated worker env (REDIS_URL, Supabase, AI keys, etc.) |
| `services/worker/src/health.ts` | Express health endpoint + Bull Board dashboard (basic auth in prod) |
| `services/worker/src/index.ts` | Worker entry point with startup banner + graceful shutdown |
| `services/worker/Dockerfile` | Multi-stage Docker build (builder → production slim) |
| `services/worker/railway.toml` | Railway config: dockerfile builder, /health check, 5 retries |
| `supabase/migrations/054_job_status.sql` | Job status table with RLS, indexes for polling/cleanup/entity lookup |

### Files Modified (5 files)

| File | Change |
|------|--------|
| `package.json` | Added `bullmq` dependency (19 packages) |
| `src/lib/config/env.ts` | Added `REDIS_URL`, `WORKER_ENABLED` env vars + `workerEnabled` feature flag |
| `src/__mocks__/config.ts` | Added mock entries for `REDIS_URL`, `WORKER_ENABLED`, `workerEnabled` |
| `.env.example` | Added `REDIS_URL` and `WORKER_ENABLED` documentation |
| `.env.production.template` | Added `REDIS_URL` and `WORKER_ENABLED` documentation |

## Decisions Made

1. **REDIS_URL vs UPSTASH_REDIS_REST_URL**: BullMQ requires standard Redis (ioredis/TCP), not the Upstash HTTP REST API. Added a separate `REDIS_URL` env var for the `rediss://` endpoint. Both endpoints are available from the same Upstash Redis instance.

2. **tsc-alias for path resolution**: TypeScript doesn't rewrite path aliases (`@/lib/*`) in compiled output. Added `tsc-alias` as a post-build step in the worker's build script to rewrite to relative paths.

3. **Worker tsconfig rootDir**: Set to `../..` (monorepo root) so TypeScript can compile both worker source and shared `src/lib/` code. Output goes to `dist/services/worker/src/` and `dist/src/lib/`.

4. **Dockerfile build context**: Dockerfile in `services/worker/` but Railway should set root directory to monorepo root so COPY commands can access `src/lib/`.

5. **Feature flag**: `WORKER_ENABLED` env var controls sync→async migration. When `false` (default), all routes work exactly as before.

## Verification

```
npx tsc --noEmit        ✅ (root project — 0 errors)
npm run build           ✅ (Next.js full build — 69 routes)
Worker tsc --noEmit     ✅ (0 errors)
Worker npm run build    ✅ (tsc + tsc-alias — path aliases rewritten)
```

## For Next Agent

- **Continue with:** Phase 2 — Migrate AI Operations (see `docs/BACKEND_INTEGRATION_PLAN.md` § Phase 2)
- **First endpoint to migrate:** `POST /api/documents/[id]/analyze` (document analysis — highest timeout risk)
- **Pattern:** API route checks `features.workerEnabled`, if true → enqueue job + return jobId, if false → existing sync path
- **Watch out for:**
  - The worker tsconfig includes `src/lib/jobs/` only — Phase 2 will need to expand `include` to cover `src/lib/ai/`, `src/lib/email/`, `src/lib/db/`, etc.
  - The `src/lib/supabase/admin.ts` admin client imports from `@/lib/config` which has Next.js-specific validation — may need a worker-compatible variant
  - Queue instances in the job status API route create a new Queue per request — consider caching for production
- **Branch:** `feat/worker-service` (created from main)
- **Railway setup needed:** Create new Railway service, set root dir to monorepo root, configure env vars
