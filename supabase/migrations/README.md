# Database Migrations

SQL migration files for the Immigration AI PostgreSQL database (via Supabase).

## Naming Convention

Files follow the pattern `NNN_description.sql` where `NNN` is a zero-padded sequence number. Gaps in numbering are intentional (obsoleted or consolidated migrations).

## Applying Migrations

- **Supabase Dashboard:** Paste into the SQL Editor and run
- **CLI:** `supabase db push` (requires Supabase CLI configured)

**WARNING:** Never modify an existing migration that has been applied in production. Always create a new migration file to alter schema.

## Migration Template

Every new migration MUST include `SET lock_timeout = '4s';` at the top to prevent long-running schema locks from blocking production queries. Include rollback SQL in a comment block:

```sql
-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_example;
-- ALTER TABLE example DROP COLUMN IF EXISTS new_col;

SET lock_timeout = '4s';

-- Your migration here
```

## Manual Setup Required After Migrations

### Storage Bucket RLS (Migration 006)

Migration `006_storage_rls.sql` creates helper functions for Storage RLS but the actual bucket policies must be configured **manually** in the Supabase Dashboard:

1. Go to **Storage > documents bucket > Policies**
2. Add SELECT policy: `storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))`
3. Add INSERT policy: `storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))`
4. Add UPDATE policy: `storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))`
5. Add DELETE policy: `storage_user_can_delete_document(auth.uid(), storage_extract_case_id(name))`

**This must be done for each environment (staging + production).** Without these policies, Storage access is controlled only at the API route level.

## RLS Policies

This project uses Row-Level Security extensively. Nearly every table has RLS enabled with policies that enforce tenant isolation, role-based access, and data ownership. Several migrations exist solely to fix RLS recursion issues caused by cross-table policy checks. When adding new tables, always add RLS policies in the same migration.

## Migration Index

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: profiles, cases, documents, forms, enums, and base RLS policies |
| `002_security_hardening.sql` | Soft delete support, audit logging, admin RLS fixes, data retention |
| `003_billing.sql` | Subscription billing with Stripe: customers, subscriptions, invoices, plan limits |
| `004_multitenancy.sql` | Multi-tenancy: firms, firm_members, invitations, firm-scoped access |
| `005_update_case_rls.sql` | Rewrite case RLS policies to support firm-based access |
| `006_storage_rls.sql` | Storage bucket RLS policies for document file security |
| `007_two_factor_auth.sql` | Two-factor authentication tables and backup codes |
| `008_notification_preferences.sql` | Email notification preferences and delivery tracking |
| `009_gdpr_compliance.sql` | GDPR: data export, deletion requests, consent tracking |
| `010_fix_firm_members_recursion.sql` | Fix infinite recursion in firm_members RLS via SECURITY DEFINER helper |
| `011_fix_profiles_recursion.sql` | Fix infinite recursion in profiles RLS via `is_system_admin()` helper |
| `012_deadline_alerts.sql` | Deadline alerts and processing time tracking tables |
| `016_chat.sql` | AI chat assistant: conversations and messages tables |
| `017_case_messages.sql` | Attorney-client messaging per case with attachments |
| `018_document_requests.sql` | Attorney-to-client document request workflow |
| `019_tasks.sql` | Case-linked task management with assignments and priorities |
| `020_fix_firm_members_admin_check.sql` | Fix firm_members admin check to use `is_system_admin()` |
| `021_fix_cases_recursion.sql` | Fix cases/case_assignments RLS recursion with SECURITY DEFINER helpers |
| `022_database_hardening.sql` | Soft delete cascades, advisory locks, connection pooling, performance indexes |
| `027_quota_enforcement.sql` | Database-level quota enforcement triggers for cases, documents, AI requests |
| `028_security_fixes.sql` | SECURITY DEFINER fixes for quota functions, error handling for cascades |
| `029_fix_message_metadata_race.sql` | Atomic message update via JSONB merge to fix metadata race condition |
| `030_add_needs_review_status.sql` | Add `needs_review` value to document_status enum |
| `031_add_backup_code_unique_constraint.sql` | Unique constraint on backup codes to prevent replay attacks |
| `032_fix_document_quota_per_case.sql` | Fix document quota to enforce per-case limits (not aggregate) |
| `033_add_rls_policies_checklists_processing.sql` | Add missing RLS to document_checklists and processing_times tables |
| `034_backfill_cases_firm_id.sql` | Backfill NULL firm_id on cases for multi-tenant data safety |
| `035_document_quota_rpc.sql` | RPC function for optimized document quota checking |
| `036_email_log_unique_constraint.sql` | Idempotency key on email_log to prevent duplicate billing emails |
| `051_audit_log_append_only.sql` | Enforce append-only audit_log (RLS + trigger) for USCIS compliance |
| `052_encrypt_form_sensitive_fields.sql` | Add `form_data_encrypted` flag for app-layer AES-256-GCM encryption |
| `053_audit_log_archive.sql` | Archive table and function for audit log cold storage before retention cleanup |
