# Custom Security Scan Instructions for Immigration AI

## Application Context

This is an **immigration case management platform** handling highly sensitive data:
- Personally Identifiable Information (PII): names, addresses, SSNs, A-numbers
- Legal documents: passports, visas, immigration forms
- Attorney-client privileged communications
- Financial billing information

## Priority Vulnerability Categories

### Critical - Must Flag
1. **PII Exposure**: Any route or component that could leak client PII (SSN, passport numbers, A-numbers) through logs, error messages, API responses, or client-side state
2. **Authentication Bypass**: Flaws in Supabase Auth, MFA/2FA, or session handling that could allow unauthorized access
3. **Authorization Failures**: Missing or incorrect Row Level Security (RLS) policies, broken RBAC checks, privilege escalation between attorney/client/admin roles
4. **Document Access Control**: Unauthorized access to uploaded legal documents (passports, forms, evidence)
5. **API Key Exposure**: Any server-side secret (ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY) exposed to client-side code

### High - Should Flag
6. **Injection Attacks**: SQL injection through Supabase queries, XSS in form fields or document names, command injection in file processing
7. **Insecure File Handling**: Bypassing magic-byte validation, unrestricted file uploads, path traversal in document storage
8. **Encryption Weaknesses**: Improper encryption of PII at rest, weak key management, missing encryption for sensitive fields
9. **Rate Limiting Bypass**: Circumventing rate limits on AI endpoints, login attempts, or API routes
10. **Audit Trail Gaps**: Missing audit logging for document access, case modifications, or admin actions

### Medium - Worth Noting
11. **CORS Misconfiguration**: Overly permissive cross-origin policies
12. **Insecure Dependencies**: Known CVEs in npm packages
13. **Information Disclosure**: Verbose error messages revealing system internals
14. **Session Management**: Insecure session handling, missing token rotation

## Architecture-Specific Checks

### Supabase / Database
- Verify RLS policies exist for ALL tables with sensitive data
- Check that `service_role` key is NEVER used in client-side code
- Ensure database functions use `SECURITY DEFINER` only when necessary
- Validate that billing/plan enforcement triggers cannot be bypassed

### Next.js App Router
- Server Components should never pass secrets to Client Components
- API routes must validate authentication before processing
- Middleware must enforce auth redirects correctly
- Server Actions must re-validate permissions (not trust client state)

### AI Integration
- Ensure AI prompts don't include raw PII unnecessarily
- Check for prompt injection vulnerabilities in user-provided form data sent to AI
- Verify AI responses are sanitized before rendering
- Confirm AI API calls have proper error handling (no key leakage in errors)

### File Upload / Documents
- Verify magic-byte validation in `/src/lib/file-validation/`
- Check for path traversal in document storage paths
- Ensure document download endpoints verify user ownership via RLS
- Validate file size limits are enforced server-side

## False Positive Guidance

### Ignore These Patterns
- Placeholder/fallback values in CI environment variables (e.g., `'placeholder-key'` in GitHub Actions)
- Test files using mock encryption keys or test credentials
- Type definitions that reference sensitive field names without actual data
- shadcn/ui components in `src/components/ui/` (third-party managed code)

### Context for Common Patterns
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are **intentionally** public (Supabase design)
- Files in `src/__mocks__/` and `src/test-utils/` contain test fixtures, not real secrets
- The `ENCRYPTION_KEY` env var is a 256-bit hex key used for AES encryption of PII at rest
