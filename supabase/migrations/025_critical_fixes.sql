-- Migration: 025_critical_fixes.sql
-- Description: Critical fixes from database architecture analysis
--
-- P0 CRITICAL:
-- 1. Change CASCADE to RESTRICT on cases.attorney_id and cases.client_id
--    Problem: Deleting an attorney or client cascades to ALL their cases
--    This violates legal case retention requirements and audit trail integrity
--
-- P1 HIGH:
-- 2. Add database-level audit triggers for critical tables
--    Problem: Audit logging relies on app-level code which can be bypassed
--    Solution: Database triggers ensure all changes are logged
--
-- 3. Add email index on profiles table
--    Problem: Frequent email lookups (login, search) lack index
--
-- Created: 2024

-- ============================================================================
-- P0: FIX CASCADE DELETE ON CASES FOREIGN KEYS
-- ============================================================================
-- Instead of deleting all cases when an attorney/client is deleted,
-- we RESTRICT deletion if they have any cases.
-- The proper workflow is to reassign cases before deleting the user.

-- Drop the old foreign key constraints
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_attorney_id_fkey;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_client_id_fkey;

-- Re-add with RESTRICT instead of CASCADE
ALTER TABLE cases
  ADD CONSTRAINT cases_attorney_id_fkey
    FOREIGN KEY (attorney_id)
    REFERENCES profiles(id)
    ON DELETE RESTRICT;

ALTER TABLE cases
  ADD CONSTRAINT cases_client_id_fkey
    FOREIGN KEY (client_id)
    REFERENCES profiles(id)
    ON DELETE RESTRICT;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT cases_attorney_id_fkey ON cases IS
  'RESTRICT prevents accidental deletion of attorneys with cases. Reassign cases first.';

COMMENT ON CONSTRAINT cases_client_id_fkey ON cases IS
  'RESTRICT prevents accidental deletion of clients with cases. Reassign cases first.';

-- ============================================================================
-- P1: ADD EMAIL INDEX ON PROFILES
-- ============================================================================
-- Email is used for login, search, and lookup operations

CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON profiles(email);

-- Also add a unique constraint if not exists (email should be unique)
-- Note: This may fail if there are duplicate emails, hence the DO block
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Email unique constraint already exists';
  WHEN unique_violation THEN
    RAISE WARNING 'Duplicate emails exist in profiles table - cannot add unique constraint';
END $$;

-- ============================================================================
-- P1: DATABASE-LEVEL AUDIT TRIGGERS
-- ============================================================================
-- Create audit triggers that fire on INSERT/UPDATE/DELETE for critical tables
-- This provides defense-in-depth: even if app-level logging fails, DB catches it

-- Create the audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields JSONB;
  v_user_id UUID;
BEGIN
  -- Get the user ID from the session (Supabase sets this)
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Calculate changed fields for UPDATE operations
    SELECT jsonb_object_agg(key, value)
    INTO v_changed_fields
    FROM jsonb_each(v_new_data)
    WHERE v_old_data->key IS DISTINCT FROM value;
  END IF;

  -- Insert into audit_log
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    changed_at,
    metadata
  ) VALUES (
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::TEXT
      ELSE (NEW.id)::TEXT
    END,
    TG_OP,
    v_old_data,
    v_new_data,
    v_user_id,
    NOW(),
    jsonb_build_object(
      'trigger_name', TG_NAME,
      'changed_fields', COALESCE(v_changed_fields, '{}'::jsonb)
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_function() IS
  'Generic audit trigger that logs all changes to the audit_log table';

-- ============================================================================
-- CREATE AUDIT TRIGGERS ON CRITICAL TABLES
-- ============================================================================

-- Cases - legal documents, must track all changes
DROP TRIGGER IF EXISTS audit_cases_trigger ON cases;
CREATE TRIGGER audit_cases_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Documents - legal evidence, must track all changes
DROP TRIGGER IF EXISTS audit_documents_trigger ON documents;
CREATE TRIGGER audit_documents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Forms - legal filings, must track all changes
DROP TRIGGER IF EXISTS audit_forms_trigger ON forms;
CREATE TRIGGER audit_forms_trigger
  AFTER INSERT OR UPDATE OR DELETE ON forms
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Profiles - user identity changes
DROP TRIGGER IF EXISTS audit_profiles_trigger ON profiles;
CREATE TRIGGER audit_profiles_trigger
  AFTER UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Firm members - access control changes
DROP TRIGGER IF EXISTS audit_firm_members_trigger ON firm_members;
CREATE TRIGGER audit_firm_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON firm_members
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Subscriptions - billing changes
DROP TRIGGER IF EXISTS audit_subscriptions_trigger ON subscriptions;
CREATE TRIGGER audit_subscriptions_trigger
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- ENSURE AUDIT_LOG TABLE HAS REQUIRED COLUMNS
-- ============================================================================
-- The audit_log table may have been created in a previous migration,
-- but let's ensure it has all the columns we need

-- Add metadata column if it doesn't exist
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index for querying by table and record
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON audit_log(table_name, record_id);

-- Add index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
  ON audit_log(changed_by);

-- Add index for time-range queries
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
  ON audit_log(changed_at DESC);

-- ============================================================================
-- HELPER FUNCTION: REASSIGN CASES BEFORE USER DELETION
-- ============================================================================
-- Since we now RESTRICT deletion, provide a helper to reassign cases

CREATE OR REPLACE FUNCTION reassign_user_cases(
  p_old_user_id UUID,
  p_new_attorney_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count cases to be affected
  SELECT COUNT(*) INTO v_count
  FROM cases
  WHERE attorney_id = p_old_user_id OR client_id = p_old_user_id;

  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  -- If new attorney provided, reassign attorney cases
  IF p_new_attorney_id IS NOT NULL THEN
    UPDATE cases
    SET attorney_id = p_new_attorney_id,
        updated_at = NOW()
    WHERE attorney_id = p_old_user_id;
  END IF;

  -- Note: Client cases should generally not be reassigned,
  -- as the client is the subject of the case.
  -- This function primarily helps with attorney reassignment.

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reassign_user_cases(UUID, UUID) IS
  'Helper to reassign cases from one attorney to another before deletion. Returns count of affected cases.';

-- ============================================================================
-- VERIFICATION QUERY (for manual verification after migration)
-- ============================================================================
-- Run this to verify the constraints are correctly set:
/*
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'cases'
  AND kcu.column_name IN ('attorney_id', 'client_id')
ORDER BY kcu.column_name;

-- Expected output:
-- table_name | column_name  | foreign_table_name | delete_rule
-- cases      | attorney_id  | profiles           | RESTRICT
-- cases      | client_id    | profiles           | RESTRICT
*/

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_profiles_email IS
  'Index for email lookups during authentication and search';

COMMENT ON TRIGGER audit_cases_trigger ON cases IS
  'Audit trigger for legal case changes - required for compliance';

COMMENT ON TRIGGER audit_documents_trigger ON documents IS
  'Audit trigger for document changes - required for evidence chain';

COMMENT ON TRIGGER audit_forms_trigger ON forms IS
  'Audit trigger for form changes - required for filing records';

COMMENT ON TRIGGER audit_profiles_trigger ON profiles IS
  'Audit trigger for profile changes - tracks identity modifications';

COMMENT ON TRIGGER audit_firm_members_trigger ON firm_members IS
  'Audit trigger for firm membership changes - tracks access control';

COMMENT ON TRIGGER audit_subscriptions_trigger ON subscriptions IS
  'Audit trigger for subscription changes - tracks billing modifications';
