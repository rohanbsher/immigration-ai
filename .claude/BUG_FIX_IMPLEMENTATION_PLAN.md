# Bug Fix Implementation Plan

**Created:** 2026-02-02
**Status:** Ready for Implementation
**Total Tasks:** 7 (5 Critical, 2 Minor)

---

## Executive Summary

Staff engineer review identified 7 issues in recent changes. Deep analysis via sub-agents revealed root causes and safe fix strategies. This plan ensures fixes don't introduce regressions.

| Priority | Issue | Risk if Unfixed |
|----------|-------|-----------------|
| P0 | updateMessage metadata clobbering | Data loss in chat messages |
| P0 | Document status race condition | Stuck documents, incorrect state |
| P1 | Tests use duplicated logic | Silent regressions |
| P1 | SSE no keepalive | Broken long-running chats on Vercel |
| P1 | Quota triggers lack SECURITY DEFINER | Paid users get free limits |
| P2 | Email normalization asymmetric | Potential invitation failures |
| P3 | Placeholder tests | False confidence |

---

## Task 1: Fix updateMessage Metadata Clobbering (P0)

### Root Cause
```typescript
// CURRENT (BROKEN): Overwrites entire metadata
updatePayload.metadata = { status: updates.status };

// SHOULD: Merge with existing metadata
// But fetch-then-update was removed for performance
```

### Analysis Summary
- **Callers:** Only 2 in `/api/chat/route.ts` (lines 149, 160)
- **Return value:** Neither caller uses it (void is fine)
- **Risk:** If message had other metadata fields, they'd be lost

### Implementation

**File:** `src/lib/db/conversations.ts`

```typescript
export async function updateMessage(
  messageId: string,
  updates: {
    content?: string;
    status?: MessageStatus;
  }
): Promise<void> {
  const supabase = await createClient();

  // Build update payload - use JSONB concatenation for atomic merge
  const updatePayload: Record<string, unknown> = {};

  if (updates.content !== undefined) {
    updatePayload.content = updates.content;
  }

  if (updates.status !== undefined) {
    // Use raw SQL for atomic JSONB merge instead of overwrite
    // This preserves existing metadata keys while updating status
    const { error } = await supabase.rpc('update_message_with_status', {
      p_message_id: messageId,
      p_content: updates.content ?? null,
      p_status: updates.status,
    });

    if (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
    return;
  }

  // Content-only update (no status)
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from('conversation_messages')
      .update(updatePayload)
      .eq('id', messageId);

    if (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }
}
```

**Alternative (simpler, if RPC not desired):**
```typescript
// Use JSONB merge operator in raw update
if (updates.status !== undefined) {
  updatePayload.metadata = supabase.sql`metadata || jsonb_build_object('status', ${updates.status})`;
}
```

### Validation Steps
1. Add test: Create message with metadata `{ status: 'streaming', tokens: 100 }`
2. Call updateMessage with `{ status: 'complete' }`
3. Verify metadata is `{ status: 'complete', tokens: 100 }` (tokens preserved)

---

## Task 2: Fix Document Status Race Condition (P0)

### Root Cause
```typescript
const { id } = await params;  // Extracted BEFORE try
try {
  // ... auth checks that can fail ...
  await documentsService.updateDocument(id, { status: 'processing' }); // Line 108
  // ...
} catch (error) {
  // PROBLEM: Resets status even if we never set it to 'processing'
  await documentsService.updateDocument(id, { status: 'uploaded' });
}
```

### Implementation

**File:** `src/app/api/documents/[id]/analyze/route.ts`

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let statusWasSet = false;
  let documentId: string | null = null;

  try {
    const { id } = await params;
    documentId = id;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... rate limiting, document fetch ...

    // ADDED: Prevent re-analyzing verified/rejected documents
    if (['verified', 'rejected'].includes(document.status)) {
      return NextResponse.json(
        { error: `Cannot re-analyze a ${document.status} document` },
        { status: 400 }
      );
    }

    // Set status to processing - NOW we track it
    await documentsService.updateDocument(id, { status: 'processing' });
    statusWasSet = true;  // ADDED: Track that we changed status

    // ... rest of analysis logic ...

  } catch (error) {
    // FIXED: Only reset if we actually changed the status
    if (statusWasSet && documentId) {
      try {
        await documentsService.updateDocument(documentId, { status: 'uploaded' });
      } catch (resetErr) {
        log.logError('Failed to reset document status', resetErr);
      }
    }
    log.logError('Error analyzing document', error);
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    );
  }
}
```

### Validation Steps
1. Test: Auth failure → status should NOT change
2. Test: SSRF failure → status should reset to 'uploaded'
3. Test: Already 'verified' → should return 400, no status change
4. Test: AI error after 'processing' → should reset to 'uploaded'

---

## Task 3: Export validateStorageUrl for Testing (P1)

### Root Cause
Tests duplicate 50 lines of validation logic. If real function changes, tests still pass.

### Implementation

**Create:** `src/lib/security/url-validation.ts`
```typescript
/**
 * Validates that a URL is from our trusted Supabase storage.
 * Prevents SSRF attacks by ensuring only internal storage URLs are processed.
 */
export function validateStorageUrl(urlString: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  try {
    const url = new URL(urlString);
    const expectedBaseUrl = new URL(supabaseUrl);

    // 1. Origin validation
    if (url.origin !== expectedBaseUrl.origin) return false;

    // 2. Protocol must be HTTPS
    if (url.protocol !== 'https:') return false;

    // 3. Path must start with storage prefix
    if (!url.pathname.startsWith('/storage/v1/object/')) return false;

    // 4. No path traversal
    if (url.pathname.includes('..') || url.pathname.includes('//')) return false;

    // 5. Bucket allowlist
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 5) return false;

    const bucket = pathParts[4];
    const allowedBuckets = ['documents'];
    if (!allowedBuckets.includes(bucket)) return false;

    return true;
  } catch {
    return false;
  }
}
```

**Update:** `src/app/api/documents/[id]/analyze/route.ts`
```typescript
import { validateStorageUrl } from '@/lib/security/url-validation';
// Remove the local function definition
```

**Update:** `src/app/api/documents/analyze.test.ts`
```typescript
import { validateStorageUrl } from '@/lib/security/url-validation';

// Remove the duplicated function (lines 12-54)
// Tests now use the real implementation
```

---

## Task 4: Add SSE Keepalive Mechanism (P1)

### Root Cause
- Vercel: 25s function timeout
- No keepalive → connection dies for long AI responses
- Client already ignores SSE comments (`:` lines)

### Implementation

**File:** `src/lib/api/sse.ts`
```typescript
export function createSSEStream(
  handler: SSEHandler,
  onUnhandledError?: (error: unknown) => void | Promise<void>,
  keepaliveIntervalMs: number = 20000  // 20 seconds default
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const sse: SSEController = {
        send: (event) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        },
        error: (message) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
          );
        },
      };

      try {
        // Start keepalive timer
        if (keepaliveIntervalMs > 0) {
          keepaliveTimer = setInterval(() => {
            // SSE comment format - browsers ignore this
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          }, keepaliveIntervalMs);
        }

        await handler(sse);
      } catch (error) {
        if (onUnhandledError) {
          await onUnhandledError(error);
        }
        sse.error('An unexpected error occurred');
      } finally {
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
```

### Test to Add
```typescript
it('should send keepalive comments at specified interval', async () => {
  vi.useFakeTimers();

  const response = createSSEStream(
    async (sse) => {
      // Simulate long-running operation
      await new Promise(resolve => setTimeout(resolve, 50000));
      sse.send({ type: 'done' });
    },
    undefined,
    20000  // 20s keepalive
  );

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  // Advance timer past first keepalive
  vi.advanceTimersByTime(21000);

  // Read available chunks
  const { value } = await reader.read();
  chunks.push(decoder.decode(value));

  expect(chunks.join('')).toContain(': keepalive\n\n');

  vi.useRealTimers();
});
```

---

## Task 5: Add SECURITY DEFINER to Quota Triggers (P1)

### Root Cause
- Triggers query `subscriptions` table which has RLS
- Without SECURITY DEFINER, RLS filters results to empty
- Query returns NULL → defaults to 'free' plan incorrectly

### Implementation

**File:** `supabase/migrations/027_quota_enforcement.sql`

```sql
-- Function to check case quota before insert
CREATE OR REPLACE FUNCTION check_case_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_plan TEXT;
BEGIN
  -- Count current cases
  SELECT COUNT(*) INTO current_count
  FROM cases
  WHERE attorney_id = NEW.attorney_id AND deleted_at IS NULL;

  -- Get user's plan (SECURITY DEFINER allows bypassing RLS)
  SELECT COALESCE(s.plan_type, 'free') INTO user_plan
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = NEW.attorney_id
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Handle NULL (no subscription found)
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Set limits
  max_allowed := CASE user_plan
    WHEN 'free' THEN 5
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 1000
    ELSE 5
  END;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Case quota exceeded. Current: %, Max: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Same pattern for check_document_quota()
CREATE OR REPLACE FUNCTION check_document_quota()
RETURNS TRIGGER AS $$
-- ... same structure ...
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
```

---

## Task 6: Normalize Email on Invitation Insert (P2)

### Root Cause
- Insert: `email.toLowerCase()` (no trim)
- Compare: `email.trim().toLowerCase()` (both)
- Asymmetric normalization

### Implementation

**File:** `src/lib/db/firms.ts` (createInvitation function)
```typescript
const { data, error } = await supabase
  .from('firm_invitations')
  .insert({
    firm_id: firmId,
    email: email.trim().toLowerCase(),  // CHANGED: Added trim()
    role,
    token,
    invited_by: invitedBy,
    expires_at: expiresAt.toISOString(),
  })
```

**File:** `src/app/api/firms/[id]/invitations/route.ts`
```typescript
const { data: inviteeProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', email.trim().toLowerCase())  // CHANGED: Added trim()
  .single();
```

---

## Task 7: Clean Up Placeholder Tests (P3)

### Implementation

**File:** `src/app/api/documents/analyze.test.ts`

Delete lines 210-231 (placeholder tests) OR implement properly:
```typescript
// DELETE THESE:
describe('Document Status Reset', () => {
  it('should reset status to uploaded when SSRF validation fails', () => {
    expect(true).toBe(true); // Placeholder
  });
  // ...
});
```

**File:** `src/app/api/chat/route.ts`

Fix misleading comment:
```typescript
// BEFORE:
// Parse and validate request body
const body = await request.json();

// AFTER:
// Parse request body (validated by field checks below)
const body = await request.json();
```

---

## Execution Order

```
1. Task 5: SECURITY DEFINER (migration - no code deps)
2. Task 3: Extract validateStorageUrl (enables Task 2 tests)
3. Task 2: Document status race condition
4. Task 1: updateMessage metadata
5. Task 4: SSE keepalive
6. Task 6: Email normalization
7. Task 7: Cleanup (last - no deps)
```

---

## Validation Checklist

After all fixes:
- [ ] `npm run build` passes
- [ ] `npm run test:run` passes (989+ tests)
- [ ] `npm run lint` passes
- [ ] Manual test: Long chat response (>25s) doesn't disconnect
- [ ] Manual test: Document analysis sets/resets status correctly
- [ ] Manual test: Firm invitation with spaces in email works

---

## Rollback Plan

Each fix is isolated. If any causes issues:
1. Revert the specific file(s)
2. Keep other fixes
3. Re-analyze the failing fix

Migration 027 changes are additive (SECURITY DEFINER) - rollback would require removing and re-creating triggers without it.
