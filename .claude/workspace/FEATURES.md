# Immigration AI - Features

> Last updated: 2026-02-09 (Verified via production readiness audit)

## Shipped Features

| Feature | Description | Key Files | Shipped |
|---------|-------------|-----------|---------|
| User Authentication | Email/password + OAuth + session management | `src/app/api/auth/`, `src/lib/auth/` | 2026-01 |
| Two-Factor Auth (MFA) | TOTP + backup codes (128-bit NIST) | `src/lib/2fa/`, `src/app/api/2fa/` | 2026-01 |
| Case Management | CRUD with 16 visa types, 10 statuses, filtering | `src/app/api/cases/`, `src/lib/db/cases.ts` | 2026-01 |
| Document Upload | Drag-drop, magic bytes validation, virus scanning | `src/components/documents/`, `src/lib/file-validation/` | 2026-01 |
| AI Document Analysis | GPT-4 Vision OCR with confidence scoring | `src/lib/ai/document-analysis.ts` | 2026-01 |
| AI Form Autofill | Claude-powered field mapping + consistency checks | `src/lib/ai/form-autofill.ts` | 2026-01 |
| AI Chat | SSE streaming with tool use and conversation history | `src/app/api/chat/`, `src/components/chat/` | 2026-01 |
| Role-Based Access | Attorney, client, admin roles with route guards | `src/lib/rbac/`, `src/hooks/use-role-guard.ts` | 2026-01 |
| Dashboard | Case overview, animated counters, deadline widgets | `src/app/dashboard/page.tsx` | 2026-01 |
| File Validation | Magic bytes + virus scanning (ClamAV/VirusTotal) | `src/lib/file-validation/` | 2026-01-26 |
| AI Confidence Thresholds | Attorney review for low-confidence AI results | `src/lib/form-validation/` | 2026-01-26 |
| Rate Limiting | Upstash Redis on 24+ routes with fail-closed safety | `src/lib/rate-limit/` | 2026-01-27 |
| Error Tracking | Sentry integration (server + client + edge) | `sentry.*.config.ts` | 2026-01-27 |
| PDF Generation | USCIS form PDF filling via pdf-lib | `src/lib/pdf/` | 2026-01-27 |
| Frontend RBAC | Route-level permission guards with redirect | `src/hooks/use-role-guard.ts` | 2026-01-27 |
| Stripe Billing (Backend) | Subscriptions, webhooks, quota enforcement | `src/app/api/billing/`, `src/lib/stripe/` | 2026-01-28 |
| Multi-Tenancy (Backend) | Firms, members, invitations with RLS | `src/app/api/firms/`, `src/lib/db/firms.ts` | 2026-01-28 |
| Structured Logging | createLogger across entire codebase | `src/lib/logger/` | 2026-02-02 |
| SSE Keepalive | Configurable keepalive for Vercel timeout | `src/lib/api/sse.ts` | 2026-02-02 |
| SSRF Protection | URL validation with encoding bypass prevention | `src/lib/security/url-validation.ts` | 2026-02-02 |
| PII Encryption | AES-256-GCM for extracted document data | `src/lib/crypto/` | 2026-01-27 |
| Audit Logging | Activity tracking for compliance | `src/lib/audit/` | 2026-01-27 |
| GDPR Compliance | Data export and deletion endpoints | `src/app/api/gdpr/` | 2026-01-28 |
| Stripe Billing UI | Subscription management, checkout, usage meters | `src/app/dashboard/billing/`, `src/components/billing/` | 2026-02-05 |
| Multi-Tenancy UI | Firm switcher, team management, invitations | `src/app/dashboard/firm/`, `src/components/firm/` | 2026-02-05 |
| Production Readiness Fixes | AI timeouts, CAS autofill, admin pages, auth hardening | Various | 2026-02-06 |
| Email Notifications | Resend integration with templates (welcome, case update, deadline, invitation) | `src/lib/email/`, `src/components/notifications/` | 2026-02-05 |
| Activity Timeline | Real timeline component replacing placeholder | `src/components/dashboard/activity-timeline.tsx`, `src/app/api/activities/` | 2026-02-06 |
| GDPR Privacy UI | Settings privacy tab with data export + account deletion | `src/app/dashboard/settings/` | 2026-02-06 |
| Admin Dashboard Pages | Subscriptions, audit-logs, system admin pages | `src/app/dashboard/admin/` | 2026-02-06 |
| Deadline Alerts | Vercel cron job (daily 6 AM UTC) | `src/app/api/cron/deadline-alerts/` | 2026-01-28 |
| Document Checklists | Visa-specific document requirements | `src/app/api/document-checklists/` | 2026-01-28 |
| Security Headers | CSP, HSTS, X-Frame-Options, Permissions-Policy | `next.config.ts` | 2026-01-27 |
| Client Portal | Limited client access to own cases/documents | `src/app/dashboard/client/` | 2026-02-06 |
| Analytics Dashboard | Case outcomes, processing time metrics (lazy-loaded charts) | `src/app/dashboard/analytics/` | 2026-02-06 |
| Task Management | Task CRUD with assignment and filtering | `src/app/api/tasks/`, `src/app/dashboard/tasks/` | 2026-01-28 |
| Document Requests | Request docs from clients, track fulfillment | `src/app/api/document-requests/` | 2026-01-28 |
| Cookie Consent Banner | GDPR-compliant with Accept/Reject | `src/components/consent/cookie-consent-banner.tsx` | 2026-02-07 |
| AI Consent Modal | Separate consent for OpenAI/Anthropic processing | `src/components/ai/ai-consent-modal.tsx` | 2026-02-07 |
| Legal Pages | Privacy policy, terms, AI disclaimer | `src/app/(legal)/` | 2026-02-07 |
| SEO | Sitemap, robots.txt, Open Graph metadata | `src/app/sitemap.ts`, `src/app/robots.ts` | 2026-02-06 |
| Session Expiry Warning | 5-min countdown + extend option | `src/components/session/session-expiry-warning.tsx` | 2026-02-06 |

## Planned

_No features currently planned. All 30+ features shipped._

## Deferred

- Accessibility (WCAG 2.1)
- Internationalization (i18n)
- Upload progress indicators
- AI prompt versioning
- Real-time notifications (WebSocket)

---

## Verified Quality (2026-02-05)

### Bug Fixes Verified
- updateMessage metadata: Atomic JSONB merge (PROVEN)
- Document status race condition: statusWasSet flag (PROVEN)
- SSE keepalive: Configurable intervals + cleanup (PROVEN)
- Quota triggers: SECURITY DEFINER with safe search_path (PROVEN)
- Email normalization: trim().toLowerCase() (PROVEN)
- URL validation: Shared module, no duplication (PROVEN)
- Placeholder tests: All removed (PROVEN)

### Code Quality (Staff Engineer Review)
- URL Validation: A- grade
- SSE Keepalive: A grade
- Test Utilities: A- grade
- Stripe Webhooks: B+ grade
- updateMessage: B+ grade
- Quota Enforcement: B grade
- Document Analyze: B- grade (concurrent protection recommended)
