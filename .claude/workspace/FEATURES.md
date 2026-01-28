# Immigration AI - Features

> Last updated: 2026-01-28

## Shipped Features

| Feature | Description | Shipped |
|---------|-------------|---------|
| User Authentication | Supabase Auth with MFA support | 2026-01 |
| Case Management | Create, view, update immigration cases | 2026-01 |
| Document Upload | Secure document storage with Supabase | 2026-01 |
| AI Document Analysis | Claude vision for passport/document parsing | 2026-01 |
| Form Auto-Fill | AI-assisted USCIS form completion | 2026-01 |
| Role-Based Access | Attorney, paralegal, client roles | 2026-01 |
| Dashboard | Case overview, deadlines, activity | 2026-01 |
| File Validation | Magic bytes + virus scanning | 2026-01-26 |
| AI Confidence Thresholds | Attorney review for low-confidence AI | 2026-01-26 |
| Rate Limiting | Upstash Redis with fail-closed safety | 2026-01-27 |
| Error Tracking | Sentry integration | 2026-01-27 |
| PDF Generation | USCIS form PDF export | 2026-01-27 |
| Frontend RBAC | Route-level permission guards | 2026-01-27 |

## In Development

| Feature | Description | Status | Work Stream |
|---------|-------------|--------|-------------|
| Stripe Billing | Subscription plans, usage limits | Ready to start | WS-1 |
| Multi-Tenancy | Organization/firm management | Ready to start | WS-2 |

## Planned

| Feature | Description | Priority | Blocked By |
|---------|-------------|----------|------------|
| Email Notifications | Transactional emails via Resend | High | WS-1 |
| Deadline Reminders | Automated deadline alerts | Medium | WS-3 |
| Client Portal | Limited client access to cases | Medium | WS-2 |

## Deferred (Not This Sprint)

- Accessibility (WCAG 2.1)
- Internationalization (i18n)
- Upload progress indicators
- AI prompt versioning

---

## Feature Notes

### AI Document Analysis
- **Status:** Shipped
- **Files:** `/src/lib/ai/`, `/src/app/api/documents/`
- **Notes:** Uses Claude vision API. Confidence thresholds require attorney review for values < 0.8.

### Billing (WS-1)
- **Status:** Ready to start
- **Files:** `/src/lib/stripe/`, `/src/app/api/billing/`
- **Notes:** Free/Pro/Enterprise tiers. Usage limits on cases, documents, AI calls.

### Multi-Tenancy (WS-2)
- **Status:** Ready to start
- **Files:** `/src/lib/organizations/`, `/src/app/api/organizations/`
- **Notes:** Firms can have multiple members. RLS policies for data isolation.
