# Security Review Report -- Immigration AI Platform

**Date:** 2026-02-20
**Scanned by:** Claude Code Security Review (Opus 4.6)
**Scope:** Full codebase -- 77 API routes, auth, encryption, database, file uploads, AI integration, client-side

---

## Executive Summary

The application demonstrates a **mature security posture** with defense-in-depth: AES-256-GCM field encryption, CSRF protection, RLS on all tables, RBAC, fail-closed rate limiting, comprehensive security headers, and proper secret isolation. However, the review identified **1 critical**, **6 high**, **12 medium**, and **8 low** severity findings.

### Top 5 Priorities

| # | Severity | Finding | Action |
|---|----------|---------|--------|
| 1 | CRITICAL | MFA/2FA implemented but never enforced | Add 2FA enforcement at middleware level |
| 2 | HIGH | Role escalation via direct Supabase signup | Add role allowlist in DB trigger |
| 3 | HIGH | Decrypted PII (SSNs, passports) returned to browser | Add masking/presentation layer |
| 4 | HIGH | Single encryption key, no rotation | Implement key versioning + rotation |
| 5 | HIGH | 2FA token validation blocks backup codes | Increase max length to 32+ |

---

## Findings by Severity

### CRITICAL (1)

#### C-1: MFA/2FA Is Implemented but Never Enforced

- **Location:** `src/lib/supabase/middleware.ts` (no 2FA check), `src/lib/auth/api-helpers.ts:185-290`
- **Description:** The app has a complete 2FA implementation (TOTP + backup codes), but it is never enforced. The middleware checks auth status and role but never checks 2FA completion. The `isTwoFactorRequired()` function exists in `src/lib/2fa/index.ts:308` but is never called outside tests.
- **Impact:** A user who enables 2FA gains zero protection. Password compromise = full account access to all PII (SSNs, passports, A-numbers).
- **Recommendation:** After `getUser()` succeeds in middleware, check if user has 2FA enabled via `two_factor_auth` table. If enabled but not verified for the current session, redirect to a 2FA interstitial page. Enforce on API routes via `authenticate()`.

---

### HIGH (6)

#### H-1: Role Escalation via Supabase Signup Metadata

- **Location:** `supabase/migrations/038_fix_handle_new_user_trigger.sql:21-23`, `src/app/api/auth/register/route.ts:17`
- **Description:** The `handle_new_user()` trigger reads `role` from `raw_user_meta_data` and accepts any valid enum value including `'admin'`. The API validates `['attorney', 'client']` only, but a user calling Supabase Auth directly could set `role: 'admin'`.
- **Impact:** Attacker creates admin account, gaining access to all cases, documents, profiles, and audit logs.
- **Recommendation:** Add allowlist in trigger:
  ```sql
  CASE WHEN NEW.raw_user_meta_data->>'role' IN ('attorney', 'client')
    THEN (NEW.raw_user_meta_data->>'role')::user_role
    ELSE 'client'
  END
  ```

#### H-2: Decrypted PII Returned to Browser (Documents)

- **Location:** `src/lib/db/documents.ts:77-92`, `src/app/api/documents/[id]/route.ts:119`
- **Description:** `GET /api/documents/[id]` automatically decrypts `ai_extracted_data` and returns full plaintext PII (SSNs, passport numbers, A-numbers) in JSON. This data is in browser memory, developer tools, and browser extensions.
- **Impact:** All AI-extracted PII exposed as plaintext in the browser.
- **Recommendation:** Add a masking layer (e.g., `***-**-6789` for SSN). Only return full values on explicit "reveal" action with audit logging.

#### H-3: Decrypted PII Returned to Browser (Forms)

- **Location:** `src/lib/db/forms.ts:54-62`, `src/app/api/forms/[id]/route.ts:80`
- **Description:** Same as H-2 but for form data. `form_data` and `ai_filled_data` are fully decrypted before returning, including `beneficiary_passport_number`, `ssn`, `alien_number`.
- **Impact:** Aggregated PII from multiple documents in a single response, all in plaintext.
- **Recommendation:** Same masking approach as H-2.

#### H-4: Single Global Encryption Key with No Rotation

- **Location:** `src/lib/crypto/index.ts:34-64`
- **Description:** All tenants share one `ENCRYPTION_KEY`. No key rotation mechanism, no per-tenant key derivation. The `v: 1` version field exists but is hardcoded.
- **Impact:** Single key compromise decrypts ALL PII ever stored across the entire platform.
- **Recommendation:** Implement key rotation via the existing `v` field. Consider HKDF-based per-tenant key derivation from the master key.

#### H-5: 2FA Token Validation Blocks Backup Codes

- **Location:** `src/app/api/2fa/verify/route.ts:12`, `src/app/api/2fa/disable/route.ts:11`
- **Description:** Zod schema constrains token to `max(8)`, but backup codes are 32 hex characters. Users cannot use backup codes through these endpoints.
- **Impact:** Permanent account lockout if authenticator app is lost (once 2FA enforcement is added).
- **Recommendation:** Change to `z.string().min(6).max(64)` on both endpoints.

#### H-6: IP-Based Rate Limiting Before Auth on 2FA Verification

- **Location:** `src/app/api/2fa/verify/route.ts:18-19`, plus 7+ other routes
- **Description:** Multiple routes rate-limit using raw `x-forwarded-for` before authentication instead of the hardened `getClientIp()` utility. The 2FA verify endpoint is most critical -- its rate limit (5/min) is the primary brute-force protection for 6-digit TOTP codes (1M possible values).
- **Impact:** Attacker spoofs `x-forwarded-for` to bypass rate limits, enabling faster TOTP brute-force.
- **Recommendation:** Rate-limit by authenticated user ID post-auth. For pre-auth endpoints, use the hardened `getClientIp()`.

---

### MEDIUM (12)

#### M-1: RBAC Default-Allow for Unmatched Routes

- **Location:** `src/lib/rbac/index.ts:101-103`
- **Description:** `canAccessRoute()` returns `{ allowed: true }` when no permission rule matches. New dashboard routes are accessible to all roles unless explicitly configured.
- **Recommendation:** Default-deny for routes under `/dashboard` and `/admin`.

#### M-2: Middleware Does Not Protect API Routes

- **Location:** `src/lib/supabase/middleware.ts:218-226`
- **Description:** Only page routes are in `protectedPaths`. API routes rely on each handler implementing its own auth check.
- **Recommendation:** Add API route protection with an allowlist for public endpoints.

#### M-3: Firm-ID Null Check Allows Cross-Firm Access

- **Location:** `src/lib/auth/api-helpers.ts:384-387`
- **Description:** `checkFirmIdMatch()` returns `true` when either firm_id is null ("legacy data"). Attorneys from one firm could access unassigned cases.
- **Recommendation:** Backfill `firm_id` on all cases, then change to deny-when-null.

#### M-4: `date_of_birth` Inconsistently Encrypted

- **Location:** `src/app/api/clients/[id]/route.ts:149-156`
- **Description:** DOB is in `SENSITIVE_FIELDS` in the crypto module but stored plaintext in the profiles table PATCH handler.
- **Recommendation:** Encrypt consistently or remove from SENSITIVE_FIELDS with documented rationale.

#### M-5: `select('*')` Over-Exposes Profile Data

- **Location:** `src/lib/db/clients.ts:228,457-470`, `src/lib/db/profiles.ts:49,103,121`
- **Description:** Multiple queries return all columns including encrypted alien_number blobs and plaintext DOB.
- **Recommendation:** Replace with explicit column lists. Never return encrypted blobs to the client.

#### M-6: Audit Log INSERT Policy Too Permissive

- **Location:** `supabase/migrations/051_audit_log_append_only.sql:43-46`
- **Description:** INSERT policy uses `WITH CHECK (true)`. Any authenticated user can insert audit entries attributed to other users.
- **Recommendation:** Restore `changed_by = auth.uid()` check.

#### M-7: SECURITY DEFINER Functions Missing `search_path`

- **Location:** `supabase/migrations/003_billing.sql`, `supabase/migrations/004_multitenancy.sql`
- **Description:** Several early SECURITY DEFINER functions lack `SET search_path = public, pg_catalog` (billing: `get_current_usage`, `check_quota`, `get_or_create_customer`; multitenancy: `create_firm_with_owner`, `get_user_firm_role`, etc.).
- **Recommendation:** Add `SET search_path` to all remaining SECURITY DEFINER functions.

#### M-8: Quota Triggers Have Hardcoded Limits (Stale)

- **Location:** `supabase/migrations/028_security_fixes.sql:42-47`, `supabase/migrations/032_fix_document_quota_per_case.sql:53-58`
- **Description:** DB triggers enforce old limits (Free: 5 cases) while UI and `plan_limits` table show new limits (Free: 100 cases).
- **Recommendation:** Read from `plan_limits` table instead of hardcoding.

#### M-9: Prompt Injection Risk in Chat

- **Location:** `src/lib/ai/chat/index.ts:50-53`, `src/lib/ai/chat/context-builder.ts:228-277`
- **Description:** User messages passed directly to Anthropic API without prompt-injection guardrails. Context includes client names, case IDs, deadlines.
- **Recommendation:** Add explicit anti-injection instructions to system prompt. Consider input pattern detection.

#### M-10: Client PII Sent Unfiltered in Chat Context

- **Location:** `src/lib/ai/chat/context-builder.ts:154-176`
- **Description:** Client name, email, case titles, and document filenames sent to AI on every chat message -- unlike form autofill which uses `filterPiiFromExtractedData`.
- **Recommendation:** Apply PII filtering to chat context. Redact email at minimum.

#### M-11: CSP Includes `unsafe-inline` for Scripts

- **Location:** `next.config.ts:66-92`
- **Description:** Required for Next.js hydration but reduces XSS protection.
- **Recommendation:** Implement nonce-based CSP via middleware.

#### M-12: AI-Generated Search Filters Not Validated Against Enums

- **Location:** `src/lib/ai/natural-search.ts:168-224`
- **Description:** AI-generated filter values (`visaType`, `status`) used in queries without validation against known enum sets.
- **Recommendation:** Validate against allowed value lists before querying.

---

### LOW (8)

| ID | Finding | Location |
|----|---------|----------|
| L-1 | Dev encryption fallback is deterministic all-zeros | `src/lib/crypto/index.ts:26` |
| L-2 | Client email in error log context | `src/lib/db/clients.ts:397` |
| L-3 | GDPR export data handling unclear | `src/app/api/gdpr/export/route.ts:95-97` |
| L-4 | AI response text not sanitized (mitigated by React) | `src/app/api/chat/route.ts:167-169` |
| L-5 | Chat tool `case_id` input not validated as UUID | `src/lib/ai/chat/tools.ts:137` |
| L-6 | Invitation GET endpoint unauthenticated | `src/app/api/firms/invitations/[token]/route.ts:13` |
| L-7 | Deadline alert PATCH lacks Zod validation | `src/app/api/cases/deadlines/[alertId]/route.ts:54` |
| L-8 | Cron route leaks database error details | `src/app/api/cron/audit-archive/route.ts:63` |

---

## Positive Findings (Security Strengths)

The application has significant security infrastructure already in place:

- **Server-side session verification** -- consistently uses `getUser()` over `getSession()`
- **AES-256-GCM encryption** -- proper IVs, auth tags, tamper detection
- **RLS on all tables** -- verified across all migrations
- **No SQL injection** -- all queries use Supabase SDK (parameterized)
- **No XSS vectors** -- zero `dangerouslySetInnerHTML` usage
- **CSRF protection** -- Origin/Referer validation in middleware
- **Timing-safe comparisons** -- backup codes, HMAC, cron secrets
- **Atomic 2FA rate limiting** -- PostgreSQL advisory locks prevent TOCTOU
- **Role escalation prevention** -- registration restricted to attorney/client
- **Open redirect prevention** -- auth callback validates against allowlist
- **Comprehensive security headers** -- HSTS, CSP, X-Frame-Options, COOP, CORP
- **File upload security** -- magic-byte validation, virus scanning, size limits, path randomization
- **PII filtering for AI** -- `filterPiiFromExtractedData` on form autofill
- **Sentry PII sanitization** -- SSN/passport patterns redacted before transmission
- **Document access control** -- signed URLs with short expiry, ownership verification
- **Append-only audit logs** -- with trigger enforcement
- **AI consent enforcement** -- explicit opt-in before PII processing
- **Safe error handling** -- generic messages to clients, details logged server-side

---

## Recommendations Summary

### Immediate (Critical/High)

1. Enforce 2FA in middleware for users who have it enabled
2. Add role allowlist in `handle_new_user()` database trigger
3. Add PII masking layer between decryption and API response
4. Implement encryption key rotation using existing `v` field
5. Fix 2FA token length validation to allow backup codes
6. Use hardened `getClientIp()` or post-auth rate limiting on all routes

### Short-Term (Medium)

7. Switch RBAC to default-deny for dashboard/admin routes
8. Add middleware-level API route protection
9. Backfill `firm_id` on legacy cases, then enforce non-null
10. Add prompt-injection guardrails to AI chat system prompt
11. Apply PII filtering to chat context (match autofill pattern)
12. Fix audit log INSERT policy to enforce `changed_by = auth.uid()`
13. Add `search_path` to remaining SECURITY DEFINER functions
14. Update quota trigger to read from `plan_limits` table

### Longer-Term

15. Implement nonce-based CSP to eliminate `unsafe-inline`
16. Add background re-scan process for degraded virus scan documents
17. Validate AI-generated search filters against known enums
18. Consider per-tenant key derivation for multi-tenancy
