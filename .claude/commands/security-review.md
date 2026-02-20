Perform a comprehensive security review of this immigration case management application. This platform handles highly sensitive PII (SSNs, passport numbers, A-numbers), legal documents, and attorney-client communications.

## Scan Focus Areas

### 1. Authentication & Authorization
- Check Supabase Auth configuration and session handling
- Verify MFA/2FA implementation in `src/lib/2fa/`
- Review RBAC enforcement in `src/lib/rbac/` and `src/hooks/use-role-guard.ts`
- Check middleware auth guards in `src/middleware.ts`
- Look for privilege escalation between roles (admin, attorney, client)

### 2. Data Protection & PII
- Verify encryption at rest for sensitive fields (SSN, passport numbers)
- Check that PII never appears in logs, error messages, or client-side state
- Review `src/lib/encryption/` for proper key management
- Ensure API responses don't over-expose sensitive data

### 3. API Route Security
- Review all routes in `src/app/api/` for:
  - Authentication checks before processing
  - Input validation and sanitization
  - Proper error handling (no secret leakage)
  - Rate limiting via `src/lib/rate-limit/`

### 4. Database Security
- Check RLS policies on all Supabase tables
- Verify `service_role` key is never in client code
- Review database migrations in `supabase/migrations/` for policy gaps

### 5. File Upload & Documents
- Review file validation in `src/lib/file-validation/`
- Check for path traversal in document storage
- Verify document access control (ownership checks)

### 6. AI Integration
- Check for prompt injection in `src/lib/ai/`
- Verify AI API keys are server-side only
- Ensure AI responses are sanitized before rendering
- Check that PII sent to AI services is minimized

### 7. Client-Side Security
- Look for XSS vectors in form inputs and rendered content
- Check for sensitive data in localStorage/sessionStorage
- Review CORS and CSP headers

### 8. Dependency Security
- Run `npm audit` for known vulnerabilities
- Check for outdated packages with known CVEs

## Output Format

For each finding, provide:
1. **Severity**: Critical / High / Medium / Low
2. **Location**: File path and line number
3. **Description**: What the vulnerability is
4. **Impact**: What an attacker could do
5. **Recommendation**: How to fix it
6. **Code snippet**: Show the vulnerable code and the suggested fix
