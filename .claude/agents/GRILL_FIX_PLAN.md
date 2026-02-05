# Grill Review Fix Plan

> Created: 2026-02-03
> Status: PENDING AUDIT

## Overview

This plan addresses the 9 issues identified in the staff engineer code review.
Organized by priority with specific implementation steps.

---

## Phase 1: Critical Issues (MUST FIX)

### Issue 1: MockFile/MockBlob Missing Interface Methods
**Priority:** CRITICAL
**File:** `src/test-utils/factories.ts`
**Estimated Lines Changed:** ~30

**Problem:** `MockFile` and `MockBlob` don't implement the full `File`/`Blob` interface. Missing `stream()`, `bytes()`, `webkitRelativePath`.

**Implementation Steps:**
1. Add `stream()` method to `MockFile`:
   ```typescript
   stream(): ReadableStream<Uint8Array> {
     const content = this._content;
     return new ReadableStream({
       start(controller) {
         controller.enqueue(content);
         controller.close();
       }
     });
   }
   ```

2. Add `bytes()` method to `MockFile`:
   ```typescript
   async bytes(): Promise<Uint8Array> {
     return new Uint8Array(this._content);
   }
   ```

3. Add `webkitRelativePath` getter:
   ```typescript
   get webkitRelativePath(): string {
     return '';
   }
   ```

4. Add same methods to `MockBlob` class

**Verification:**
```bash
npm run test:run -- src/lib/file-validation/index.test.ts
npm run build
```

---

### Issue 2: Inconsistent Test Mock Location
**Priority:** CRITICAL
**Files:** `src/test-utils/`, `CLAUDE.md`

**Problem:** New `src/test-utils/` directory doesn't match existing `src/__mocks__/` pattern.

**Decision:** Keep `src/test-utils/` as it serves a different purpose:
- `src/__mocks__/` → Module mocks (vi.mock replacements)
- `src/test-utils/` → Test factories and utilities (data generators)

**Implementation Steps:**
1. Create `src/test-utils/index.ts` barrel export:
   ```typescript
   export * from './factories';
   export * from './render';
   ```

2. Update `CLAUDE.md` to document the pattern:
   ```markdown
   ### Test Infrastructure
   - `src/__mocks__/` - Module mocks for vi.mock()
   - `src/test-utils/` - Test factories and render utilities
   ```

**Verification:**
- Check imports in test files work with barrel export

---

### Issue 3: Non-Deterministic Random in createMockNavItems
**Priority:** CRITICAL
**File:** `src/test-utils/factories.ts`

**Problem:** `Math.random()` causes flaky tests.

**Implementation Steps:**
1. Replace random with deterministic pattern:
   ```typescript
   export function createMockNavItems(count = 5): NavItem[] {
     const rolePatterns: UserRole[][] = [
       ['attorney'],
       ['attorney', 'client'],
       ['attorney', 'client', 'admin'],
     ];

     const items: NavItem[] = [];
     for (let i = 0; i < count; i++) {
       items.push({
         label: `Nav Item ${i + 1}`,
         href: `/dashboard/item-${i + 1}`,
         allowedRoles: rolePatterns[i % rolePatterns.length],
       });
     }
     return items;
   }
   ```

**Verification:**
```bash
# Run multiple times, should be identical
npm run test:run -- --reporter=json 2>&1 | grep -c "passed"
```

---

## Phase 2: High Priority (SHOULD FIX)

### Issue 4: vercel.json Cache Header Too Aggressive
**Priority:** HIGH
**File:** `vercel.json`

**Problem:** Blanket `no-store` on all API routes is inefficient.

**Implementation Steps:**
1. Remove blanket headers from vercel.json
2. Set cache headers per-route in code where needed:
   - Auth routes: Already have proper headers
   - Health endpoint: Can cache for 60s
   - Billing: No cache (sensitive)

**Updated vercel.json:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/deadline-alerts",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Verification:**
```bash
npm run build
curl -I localhost:3000/api/health  # Check headers
```

---

### Issue 5: Stripe Webhook Type May Be Incorrect
**Priority:** HIGH
**File:** `src/lib/stripe/webhooks.ts`

**Problem:** Type assumes `subscription` could be object, but need to verify actual Stripe API behavior.

**Implementation Steps:**
1. Check Stripe API documentation for `invoice.payment_failed` event
2. Verify if subscription is expanded by default (it's not)
3. Narrow type to match actual behavior:
   ```typescript
   type ExtendedStripeInvoice = Stripe.Invoice & {
     // subscription is always string ID unless explicitly expanded
     subscription: string | null;
   };
   ```

4. Add JSDoc comment explaining the type:
   ```typescript
   /**
    * Invoice type for webhook handlers.
    * Note: subscription is always a string ID in webhooks (not expanded).
    * Use stripe.subscriptions.retrieve() if full object needed.
    */
   ```

**Verification:**
- Review Stripe webhook test events
- Check existing webhook logs if available

---

### Issue 6: Missing Fallback Path Tests
**Priority:** HIGH
**File:** `src/lib/db/conversations.test.ts`

**Problem:** RPC fallback path has zero test coverage.

**Implementation Steps:**
1. Add test for function-not-found scenario:
   ```typescript
   it('should fall back when RPC function does not exist', async () => {
     // Simulate PostgreSQL error 42883 (undefined function)
     mockRpc.mockResolvedValue({
       data: null,
       error: { code: '42883', message: 'function update_message_with_metadata does not exist' }
     });

     // Mock the fallback query chain
     const mockSelect = vi.fn().mockReturnValue({
       eq: vi.fn().mockReturnValue({
         single: vi.fn().mockResolvedValue({ data: { metadata: {} }, error: null })
       })
     });
     const mockUpdate = vi.fn().mockReturnValue({
       eq: vi.fn().mockResolvedValue({ error: null })
     });

     vi.mocked(createClient).mockResolvedValue({
       rpc: mockRpc,
       from: vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })
     } as unknown as ReturnType<typeof createClient>);

     await updateMessage('msg-123', { status: 'complete' });

     // Verify fallback was used
     expect(mockSelect).toHaveBeenCalledWith('metadata');
   });
   ```

2. Add test for fallback error handling:
   ```typescript
   it('should throw on fallback fetch error', async () => {
     mockRpc.mockResolvedValue({
       data: null,
       error: { code: '42883', message: 'function does not exist' }
     });

     // Simulate fallback query failure
     // ...
   });
   ```

**Verification:**
```bash
npm run test:run -- src/lib/db/conversations.test.ts
npm run test:coverage -- src/lib/db/conversations.ts
```

---

## Phase 3: Medium Priority (NICE TO HAVE)

### Issue 7: beforeAll Polyfill in Wrong Location
**Priority:** MEDIUM
**Files:** `src/lib/file-validation/index.test.ts`, `src/setupTests.ts`

**Implementation Steps:**
1. Move polyfill to `src/setupTests.ts`:
   ```typescript
   // Polyfill Blob.prototype.arrayBuffer for jsdom
   if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
     Blob.prototype.arrayBuffer = function(): Promise<ArrayBuffer> {
       return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = () => resolve(reader.result as ArrayBuffer);
         reader.onerror = () => reject(reader.error);
         reader.readAsArrayBuffer(this);
       });
     };
   }
   ```

2. Remove `beforeAll` block from `file-validation/index.test.ts`

**Verification:**
```bash
npm run test:run  # All tests should pass
```

---

### Issue 8: Magic Bytes Duplicated
**Priority:** MEDIUM
**Files:** `src/lib/file-validation/index.ts`, `src/test-utils/factories.ts`

**Implementation Steps:**
1. Export magic bytes from file-validation:
   ```typescript
   // src/lib/file-validation/index.ts
   export const MAGIC_BYTES: Record<string, number[]> = {
     'application/pdf': [0x25, 0x50, 0x44, 0x46],
     'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
     'image/jpeg': [0xff, 0xd8, 0xff],
     'image/gif': [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
     'image/webp': [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
   };
   ```

2. Import in factories.ts:
   ```typescript
   import { MAGIC_BYTES } from '@/lib/file-validation';
   ```

**Verification:**
```bash
npm run build
npm run test:run -- src/lib/file-validation/index.test.ts
```

---

### Issue 9: Inconsistent Error Handling
**Priority:** MEDIUM
**File:** `src/lib/stripe/webhooks.ts`

**Implementation Steps:**
1. Use consistent pattern - pass error object directly to `logError`:
   ```typescript
   // Before
   }).catch((err: unknown) => {
     const message = err instanceof Error ? err.message : 'Unknown error';
     log.logError('Failed to send billing email', { error: message });
   });

   // After
   }).catch((err) => {
     log.logError('Failed to send billing email', err);
   });
   ```

2. Verify `logError` handles unknown types gracefully (it does - check logger implementation)

**Verification:**
```bash
npm run test:run -- src/lib/stripe/index.test.ts
```

---

## Execution Order

| Step | Issue | Phase | Dependencies |
|------|-------|-------|--------------|
| 1 | Issue 7 (polyfill) | 3 | None |
| 2 | Issue 1 (MockFile) | 1 | Step 1 |
| 3 | Issue 3 (random) | 1 | None |
| 4 | Issue 2 (docs) | 1 | Step 2, 3 |
| 5 | Issue 8 (magic bytes) | 3 | Step 2 |
| 6 | Issue 4 (vercel.json) | 2 | None |
| 7 | Issue 5 (Stripe types) | 2 | None |
| 8 | Issue 9 (error handling) | 3 | Step 7 |
| 9 | Issue 6 (fallback tests) | 2 | None |

---

## Success Criteria

- [ ] All 1,239+ tests pass
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] Lint passes (warnings only)
- [ ] No flaky tests (run 3x)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MockFile changes break existing tests | Medium | High | Run full test suite after each change |
| Stripe type narrowing causes runtime errors | Low | High | Verify against actual webhook payloads |
| Magic bytes export causes circular import | Low | Medium | Test build before committing |

