# Split Redis Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single Upstash Redis with a split architecture — Railway Redis for BullMQ (persistent TCP, noeviction) and Upstash for Vercel rate limiting (HTTP REST).

**Architecture:** BullMQ worker on Railway connects to a dedicated Railway Redis instance via private networking (sub-ms latency, no request caps). Vercel API routes enqueue jobs to the same Railway Redis via its public endpoint. Upstash remains solely for rate limiting in Vercel Edge/serverless functions via HTTP REST API.

**Tech Stack:** Railway Redis 7, BullMQ, ioredis, @upstash/redis (HTTP)

---

## Context

### Current State
- **One Upstash Redis database** serves both BullMQ (standard `rediss://` via `REDIS_URL`) and rate limiting (HTTP REST via `UPSTASH_REDIS_REST_URL`)
- Upstash free tier hit **500K monthly request cap** — worker returning 503
- BullMQ generates ~35K-50K commands/day even when idle (polling, Lua scripts, health checks)
- `maxmemory-policy` conflict: BullMQ needs `noeviction`, rate limiting needs `volatile-ttl`

### Target State
```
Vercel (Next.js)
  ├── Rate limiting → Upstash Redis (HTTP REST, UPSTASH_REDIS_REST_URL)
  └── Job enqueue  → Railway Redis (public TCP, REDIS_URL)

Railway Worker
  └── Job processing → Railway Redis (private TCP, REDIS_URL)
```

### Key Files
| File | Role |
|------|------|
| `src/lib/jobs/connection.ts` | BullMQ connection parsing (reads `REDIS_URL`) |
| `src/lib/jobs/queues.ts` | Queue definitions + enqueue functions |
| `src/lib/rate-limit/redis.ts` | Upstash HTTP client (reads `UPSTASH_REDIS_REST_*`) |
| `src/lib/rate-limit/health.ts` | Redis health utilities |
| `services/worker/src/config.ts` | Worker env validation |
| `services/worker/src/health.ts` | Worker health endpoint |
| `services/worker/src/index.ts` | Worker startup |
| `services/worker/railway.toml` | Railway deployment config |
| `src/lib/config/env.ts` | App env vars + feature flags |

---

## Task 1: Provision Railway Redis Service

**Purpose:** Add a Redis 7 instance to the `splendid-flow` Railway project (same project as the worker).

**Step 1: Create Redis service via Railway dashboard**

1. Go to Railway dashboard → project `splendid-flow` (ID: `43380856-f300-444d-a9ea-dd990f938d65`)
2. Click **"+ New"** → **"Database"** → **"Redis"**
3. Railway will deploy a Redis 7 container and auto-generate connection variables

**Step 2: Verify the Redis service is running**

```bash
# After Railway provisions Redis, check it appears in the project
railway status
```

**Step 3: Note the generated connection variables**

Railway Redis auto-generates these reference variables:
- `REDIS_URL` — Public connection string (`redis://default:<pw>@<host>:<port>`)
- `REDIS_PRIVATE_URL` — Private connection string (`redis://default:<pw>@redis.railway.internal:6379`)
- `REDISHOST`, `REDISPORT`, `REDISUSER`, `REDISPASSWORD` — Individual components

**Important:** The private URL (`redis.railway.internal`) is only accessible from other services in the same Railway project. The public URL is accessible from anywhere (including Vercel).

---

## Task 2: Configure Railway Redis for BullMQ

**Purpose:** Set `noeviction` policy and enable AOF persistence so BullMQ jobs are never silently dropped.

**Step 1: Set Redis configuration via Railway variables**

Railway Redis accepts configuration through environment variables on the Redis service:

```bash
# Select the Redis service in Railway dashboard, then set these variables:
# Or use Railway CLI if the Redis service is selected
REDIS_MAXMEMORY=256mb
REDIS_MAXMEMORY_POLICY=noeviction
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=everysec
```

**Alternative — if Railway Redis doesn't support env-based config:**

Connect to the Redis instance and run:
```bash
redis-cli -u <REDIS_PUBLIC_URL>
CONFIG SET maxmemory 268435456
CONFIG SET maxmemory-policy noeviction
CONFIG SET appendonly yes
CONFIG SET appendfsync everysec
CONFIG REWRITE
```

**Step 2: Verify configuration**

```bash
redis-cli -u <REDIS_PUBLIC_URL> CONFIG GET maxmemory-policy
# Expected: "noeviction"
redis-cli -u <REDIS_PUBLIC_URL> CONFIG GET appendonly
# Expected: "yes"
```

---

## Task 3: Update Worker REDIS_URL on Railway

**Purpose:** Point the BullMQ worker at Railway Redis's private endpoint instead of Upstash.

**Step 1: Set REDIS_URL on the worker service**

```bash
# From the immigration-ai project directory (linked to worker service)
railway variables --set "REDIS_URL=$REDIS_PRIVATE_URL"
```

Where `$REDIS_PRIVATE_URL` is the private connection string from Task 1, e.g.:
`redis://default:<password>@redis.railway.internal:6379`

**Important:** Use the **private** URL for the worker (same Railway project = free internal traffic, sub-ms latency).

**Step 2: Verify the variable is set**

```bash
railway variables --kv | grep REDIS_URL
```

**Step 3: Trigger a redeploy of the worker**

Railway should auto-redeploy when variables change. If not:
```bash
railway up
```

**Step 4: Verify worker health**

```bash
curl https://immigration-ai-production.up.railway.app/health
```

Expected: JSON with `status: "ok"` and queue stats showing connection.

---

## Task 4: Update Vercel REDIS_URL

**Purpose:** Point Vercel's BullMQ job enqueuing at Railway Redis's public endpoint.

**Step 1: Get the Railway Redis public URL**

From Railway dashboard, copy the **public** connection string for the Redis service. It will look like:
`redis://default:<password>@<hostname>.railway.app:<port>`

**Step 2: Replace REDIS_URL on Vercel**

```bash
# Remove old Upstash REDIS_URL
vercel env rm REDIS_URL production

# Add new Railway Redis public URL (use printf to avoid trailing newline)
printf 'redis://default:<password>@<hostname>.railway.app:<port>' | vercel env add REDIS_URL production
```

**Step 3: Verify the variable is set**

```bash
vercel env ls | grep REDIS_URL
```

**Step 4: Keep Upstash variables intact**

Verify these are still set (they power rate limiting and must NOT be removed):
```bash
vercel env ls | grep UPSTASH
```

Expected: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` both present.

**Step 5: Trigger a Vercel redeploy**

```bash
vercel --prod
```

Or push a commit to trigger auto-deploy.

---

## Task 5: Update Code — Connection Comments & Error Message

**Purpose:** Update `connection.ts` to reflect that `REDIS_URL` now points to Railway Redis, not Upstash.

**Files:**
- Modify: `src/lib/jobs/connection.ts`

**Step 1: Update the file header comment**

Replace lines 1-11 of `src/lib/jobs/connection.ts`:

```typescript
/**
 * BullMQ Redis connection configuration.
 *
 * BullMQ requires a standard Redis connection (ioredis), NOT the Upstash REST API.
 *
 * Two separate Redis instances are used:
 *   - Railway Redis: REDIS_URL (BullMQ job queues, noeviction policy)
 *     Worker uses private URL (redis://...railway.internal:6379)
 *     Vercel uses public URL (redis://...<host>.railway.app:<port>)
 *   - Upstash Redis: UPSTASH_REDIS_REST_URL (rate limiting, HTTP REST)
 *
 * This separation is required because:
 *   - BullMQ needs noeviction (jobs must never be evicted)
 *   - Rate limiting needs volatile-ttl (expired keys should auto-evict)
 *   - Vercel Edge Functions need HTTP REST (can't use TCP sockets)
 *   - Railway private networking gives sub-ms latency to the worker
 */
```

**Step 2: Update the error message in requireJobConnection()**

Replace the error message at line 52-53:

```typescript
throw new Error(
  'REDIS_URL is not configured. BullMQ requires a standard Redis connection. ' +
  'Set REDIS_URL to your Railway Redis endpoint.'
);
```

**Step 3: Remove the Upstash compatibility comment**

On line 24, change:
```typescript
enableReadyCheck: false, // Upstash compatibility
```
to:
```typescript
enableReadyCheck: false,
```

**Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: Clean (no errors).

**Step 5: Commit**

```bash
git add src/lib/jobs/connection.ts
git commit -m "docs: update connection.ts comments for Railway Redis split architecture"
```

---

## Task 6: Verify End-to-End Pipeline

**Purpose:** Confirm the full job lifecycle works: Vercel enqueues → Railway Redis stores → Worker processes.

**Step 1: Check worker health**

```bash
curl -s https://immigration-ai-production.up.railway.app/health | jq .
```

Expected: Status `ok`, queues listed, no connection errors.

**Step 2: Check Vercel app health (detailed)**

```bash
curl -s https://immigrationai.vercel.app/api/health \
  -H "x-health-detail: true" \
  -H "Authorization: Bearer <CRON_SECRET>" | jq .
```

Expected: `redis` check shows `pass` status.

**Step 3: Test job enqueue via debug endpoint**

```bash
curl -X POST https://immigrationai.vercel.app/api/debug/worker-test \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth-cookie>"
```

If the debug endpoint is available, it should enqueue a test job and return a job ID.

**Step 4: Check worker logs for job processing**

```bash
railway logs --limit 20
```

Expected: Logs showing the test job was received and processed.

**Step 5: Verify Upstash is still working for rate limiting**

```bash
# Hit any rate-limited endpoint multiple times rapidly
for i in {1..5}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://immigrationai.vercel.app/api/health
done
```

Expected: All 200 (rate limiting still functional via Upstash).

---

## Task 7: Update Memory & Documentation

**Purpose:** Record the new architecture in project memory so future agents understand the setup.

**Step 1: Update MEMORY.md**

Update the "Backend Worker Service (BullMQ)" section to reflect:
- `REDIS_URL` now points to Railway Redis (not Upstash)
- Worker uses private URL, Vercel uses public URL
- Upstash is only for rate limiting (HTTP REST)
- Railway Redis configured with `noeviction` + AOF

**Step 2: Update ARCHITECTURE.md**

Add a "Redis Architecture" section documenting the split:
- Railway Redis: BullMQ queues, noeviction, AOF, 256MB
- Upstash Redis: Rate limiting, HTTP REST, serverless-compatible

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: document split Redis architecture (Railway + Upstash)"
```

---

## Rollback Plan

If Railway Redis causes issues:

1. **Revert REDIS_URL on worker:**
   ```bash
   railway variables --set "REDIS_URL=<old-upstash-standard-url>"
   ```

2. **Revert REDIS_URL on Vercel:**
   ```bash
   vercel env rm REDIS_URL production
   printf '<old-upstash-standard-url>' | vercel env add REDIS_URL production
   ```

3. **Upgrade Upstash to Pay-As-You-Go** to handle the request volume ($0.20/100K commands)

The old Upstash standard Redis endpoint remains valid until explicitly deleted.
