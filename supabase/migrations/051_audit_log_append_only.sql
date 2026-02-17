-- Migration: 051_audit_log_append_only.sql
-- Purpose: Make audit_log table append-only to prevent tampering with compliance records
--
-- USCIS Compliance: Immigration case audit records must be retained for a minimum
-- of 7 years (8 CFR 103.2(b)(18)). Append-only enforcement ensures no record can
-- be modified or deleted through normal application paths.
--
-- Defense-in-depth strategy:
--   Layer 1: RLS policies deny UPDATE/DELETE for all roles
--   Layer 2: BEFORE trigger raises exception on UPDATE/DELETE attempts
--   Exception: The cleanup_audit_log() SECURITY DEFINER function can still delete
--   records older than the retention period. It sets a session variable
--   (app.allow_audit_delete) that the trigger checks (called via scheduled cron job).
--
-- ROLLBACK:
/*
  DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
  DROP FUNCTION IF EXISTS enforce_audit_log_append_only();
  DROP POLICY IF EXISTS "Deny all updates on audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Deny all deletes on audit_log" ON audit_log;
  DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON audit_log;
  -- Then re-create the original policies from 002_security_hardening.sql if needed
*/

SET lock_timeout = '4s';

-- ============================================================================
-- LAYER 1: RLS POLICIES
-- ============================================================================

-- Drop existing policies to avoid conflicts (idempotent)
DROP POLICY IF EXISTS "Users can create own audit entries" ON audit_log;
DROP POLICY IF EXISTS "Attorneys can view audit logs for their cases" ON audit_log;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
DROP POLICY IF EXISTS "Deny all updates on audit_log" ON audit_log;
DROP POLICY IF EXISTS "Deny all deletes on audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON audit_log;

-- Ensure RLS is enabled (idempotent, harmless if already enabled)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ALLOW: Authenticated users can insert audit entries
CREATE POLICY "Authenticated users can insert audit entries"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Re-create SELECT policies (unchanged from 002_security_hardening.sql)
CREATE POLICY "Attorneys can view audit logs for their cases"
  ON audit_log FOR SELECT
  USING (
    changed_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id::text = audit_log.record_id::text
      AND c.attorney_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM documents d
      JOIN cases c ON d.case_id = c.id
      WHERE d.id::text = audit_log.record_id::text
      AND c.attorney_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM forms f
      JOIN cases c ON f.case_id = c.id
      WHERE f.id::text = audit_log.record_id::text
      AND c.attorney_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- DENY: No role can update audit records via RLS
-- USING (false) means no existing row ever matches, so UPDATE is always denied.
-- This blocks authenticated, anon, and any custom roles.
-- Note: service_role bypasses RLS, but the trigger (Layer 2) catches that path.
CREATE POLICY "Deny all updates on audit_log"
  ON audit_log FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

-- DENY: No role can delete audit records via RLS
CREATE POLICY "Deny all deletes on audit_log"
  ON audit_log FOR DELETE
  TO public
  USING (false);

-- ============================================================================
-- LAYER 2: TRIGGER-BASED ENFORCEMENT (belt-and-suspenders)
-- ============================================================================
-- This catches UPDATE/DELETE even from service_role (which bypasses RLS)
-- and from SECURITY DEFINER functions.
--
-- Exception: The cleanup_audit_log() retention function is allowed to DELETE
-- records that are past the retention period. It sets a transaction-local
-- session variable (app.allow_audit_delete) that this trigger checks.

CREATE OR REPLACE FUNCTION enforce_audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE operations are prohibited (USCIS compliance)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Allow the retention cleanup function to delete expired records.
    -- cleanup_audit_log() sets a session variable before deleting.
    -- This is more secure than query-text matching (which is bypassable).
    IF current_setting('app.allow_audit_delete', true) = 'true' THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION 'audit_log is append-only: DELETE operations are prohibited (USCIS compliance). Use cleanup_audit_log() for retention-based removal.'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

COMMENT ON FUNCTION enforce_audit_log_append_only() IS
  'Enforces append-only behavior on audit_log table. UPDATEs are always blocked. '
  'DELETEs are blocked unless the session variable app.allow_audit_delete is set to true '
  '(only cleanup_audit_log() sets this). Required for USCIS 7-year record retention (8 CFR 103.2(b)(18)).';

-- Apply trigger (idempotent)
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_append_only();

-- ============================================================================
-- TABLE COMMENT
-- ============================================================================

COMMENT ON TABLE audit_log IS
  'Append-only audit trail for all data changes. '
  'UPDATE and DELETE are denied by both RLS policies and trigger enforcement. '
  'Required for USCIS compliance with 7-year retention (8 CFR 103.2(b)(18)). '
  'Only cleanup_audit_log() may delete records past the retention period.';
