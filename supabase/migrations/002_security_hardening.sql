-- Security Hardening Migration
-- This migration adds:
-- 1. Soft delete support for cases, documents, and forms
-- 2. Audit logging table
-- 3. Fixed admin RLS policies
-- 4. Activity log security policies
-- 5. Data retention tracking

-- ============================================
-- 1. SOFT DELETE SUPPORT
-- ============================================

-- Add deleted_at column to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to forms
ALTER TABLE forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON forms(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================
-- 2. AUDIT LOGGING TABLE
-- ============================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'restore', 'access', 'export')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  additional_context JSONB
);

-- Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);

-- RLS for audit log - only authenticated users can create entries for themselves
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only create audit entries for themselves
CREATE POLICY "Users can create own audit entries"
  ON audit_log FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- Attorneys can view audit logs for their cases
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

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- 3. FIX ADMIN RLS POLICIES
-- ============================================

-- Drop existing admin policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create proper admin policy for profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );

-- Admin policy for cases
DROP POLICY IF EXISTS "Admins can view all cases" ON cases;

CREATE POLICY "Admins can view all cases"
  ON cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admin policy for documents
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admin policy for forms
DROP POLICY IF EXISTS "Admins can view all forms" ON forms;

CREATE POLICY "Admins can view all forms"
  ON forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- 4. ACTIVITY LOG SECURITY
-- ============================================

-- Ensure activities table has RLS enabled
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Drop existing activity policies if they exist
DROP POLICY IF EXISTS "Users can create activities for their cases" ON activities;
DROP POLICY IF EXISTS "Users can view activities for their cases" ON activities;

-- Users can only create activities for cases they have access to
CREATE POLICY "Users can create activities for their cases"
  ON activities FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
      AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- Users can view activities for cases they have access to
CREATE POLICY "Users can view activities for their cases"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
      AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- ============================================
-- 5. DATA RETENTION TRACKING
-- ============================================

-- Add ai_data_expires_at column to documents for tracking AI data retention
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_data_expires_at TIMESTAMPTZ;

-- Create index for data retention cleanup queries
CREATE INDEX IF NOT EXISTS idx_documents_ai_data_expires_at
  ON documents(ai_data_expires_at)
  WHERE ai_data_expires_at IS NOT NULL AND ai_extracted_data IS NOT NULL;

-- Function to set AI data expiration (90 days from analysis)
CREATE OR REPLACE FUNCTION set_ai_data_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- When ai_extracted_data is set, set expiration to 90 days from now
  IF NEW.ai_extracted_data IS NOT NULL AND OLD.ai_extracted_data IS NULL THEN
    NEW.ai_data_expires_at := NOW() + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set AI data expiration
DROP TRIGGER IF EXISTS trigger_set_ai_data_expiration ON documents;

CREATE TRIGGER trigger_set_ai_data_expiration
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_ai_data_expiration();

-- ============================================
-- 6. UPDATE RLS POLICIES TO EXCLUDE SOFT-DELETED RECORDS
-- ============================================

-- Update cases policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Case participants can view case" ON cases;

CREATE POLICY "Case participants can view case"
  ON cases FOR SELECT
  USING (
    deleted_at IS NULL
    AND (attorney_id = auth.uid() OR client_id = auth.uid())
  );

-- Update documents policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Case participants can view documents" ON documents;

CREATE POLICY "Case participants can view documents"
  ON documents FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
      AND c.deleted_at IS NULL
      AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- Update forms policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Case participants can view forms" ON forms;

CREATE POLICY "Case participants can view forms"
  ON forms FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_id
      AND c.deleted_at IS NULL
      AND (c.attorney_id = auth.uid() OR c.client_id = auth.uid())
    )
  );

-- ============================================
-- 7. SOFT DELETE FUNCTIONS
-- ============================================

-- Function to soft delete a case (and cascade to documents/forms)
CREATE OR REPLACE FUNCTION soft_delete_case(case_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Soft delete the case
  UPDATE cases SET deleted_at = NOW() WHERE id = case_id AND deleted_at IS NULL;

  -- Soft delete associated documents
  UPDATE documents SET deleted_at = NOW() WHERE case_id = soft_delete_case.case_id AND deleted_at IS NULL;

  -- Soft delete associated forms
  UPDATE forms SET deleted_at = NOW() WHERE case_id = soft_delete_case.case_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted case
CREATE OR REPLACE FUNCTION restore_case(case_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Restore the case
  UPDATE cases SET deleted_at = NULL WHERE id = case_id AND deleted_at IS NOT NULL;

  -- Restore associated documents
  UPDATE documents SET deleted_at = NULL WHERE case_id = restore_case.case_id AND deleted_at IS NOT NULL;

  -- Restore associated forms
  UPDATE forms SET deleted_at = NULL WHERE case_id = restore_case.case_id AND deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete_case(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_case(UUID) TO authenticated;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN cases.deleted_at IS 'Soft delete timestamp. NULL means active, non-NULL means deleted.';
COMMENT ON COLUMN documents.deleted_at IS 'Soft delete timestamp. NULL means active, non-NULL means deleted.';
COMMENT ON COLUMN forms.deleted_at IS 'Soft delete timestamp. NULL means active, non-NULL means deleted.';
COMMENT ON COLUMN documents.ai_data_expires_at IS 'When AI-extracted data should be purged (90 days after analysis).';
COMMENT ON TABLE audit_log IS 'Immutable audit trail for all data changes. Required for legal compliance.';
COMMENT ON FUNCTION soft_delete_case IS 'Soft deletes a case and all associated documents and forms.';
COMMENT ON FUNCTION restore_case IS 'Restores a soft-deleted case and all associated documents and forms.';
