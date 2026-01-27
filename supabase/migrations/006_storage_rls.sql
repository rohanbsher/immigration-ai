-- Migration: 006_storage_rls.sql
-- Description: Storage bucket RLS policies for document security
-- Created: 2024

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================

-- Note: Storage policies are applied at the bucket level in Supabase.
-- These need to be configured via the Supabase dashboard or storage API.
-- This migration documents the policies that should be applied.

-- ============================================================================
-- HELPER FUNCTION: Check if user has access to a case
-- ============================================================================

CREATE OR REPLACE FUNCTION storage_user_has_case_access(
  p_user_id UUID,
  p_case_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = p_case_id
      AND c.deleted_at IS NULL
      AND (
        -- Direct ownership
        c.attorney_id = p_user_id OR
        c.client_id = p_user_id OR
        -- Firm-based access
        (
          c.firm_id IS NOT NULL AND
          EXISTS (
            SELECT 1 FROM firm_members fm
            WHERE fm.firm_id = c.firm_id
              AND fm.user_id = p_user_id
              AND (
                fm.role IN ('owner', 'admin', 'attorney') OR
                EXISTS (
                  SELECT 1 FROM case_assignments ca
                  WHERE ca.case_id = c.id AND ca.user_id = p_user_id
                )
              )
          )
        ) OR
        -- Admin access
        EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check if user can delete documents in a case
-- ============================================================================

CREATE OR REPLACE FUNCTION storage_user_can_delete_document(
  p_user_id UUID,
  p_case_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cases c
    WHERE c.id = p_case_id
      AND c.deleted_at IS NULL
      AND (
        -- Attorney on the case
        c.attorney_id = p_user_id OR
        -- Firm admin/attorney
        (
          c.firm_id IS NOT NULL AND
          EXISTS (
            SELECT 1 FROM firm_members fm
            WHERE fm.firm_id = c.firm_id
              AND fm.user_id = p_user_id
              AND fm.role IN ('owner', 'admin', 'attorney')
          )
        ) OR
        -- Admin access
        EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DOCUMENT PARSING: Extract case_id from storage path
-- Storage paths follow format: documents/{case_id}/{filename}
-- ============================================================================

CREATE OR REPLACE FUNCTION storage_extract_case_id(path TEXT)
RETURNS UUID AS $$
DECLARE
  parts TEXT[];
  case_id TEXT;
BEGIN
  -- Split path by '/'
  parts := string_to_array(path, '/');

  -- Expected format: documents/{case_id}/{filename}
  IF array_length(parts, 1) >= 2 AND parts[1] = 'documents' THEN
    case_id := parts[2];
    -- Validate UUID format
    BEGIN
      RETURN case_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STORAGE POLICY DOCUMENTATION
-- ============================================================================

-- The following policies should be configured in Supabase Storage:

-- 1. SELECT (Download) Policy for 'documents' bucket:
--    Condition: storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))

-- 2. INSERT (Upload) Policy for 'documents' bucket:
--    Condition: storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))

-- 3. UPDATE Policy for 'documents' bucket:
--    Condition: storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))

-- 4. DELETE Policy for 'documents' bucket:
--    Condition: storage_user_can_delete_document(auth.uid(), storage_extract_case_id(name))

-- ============================================================================
-- ADDITIONAL SECURITY: Document access logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'upload', 'delete')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX idx_document_access_log_created_at ON document_access_log(created_at);

-- RLS for document access log
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all access logs"
  ON document_access_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view their own access logs"
  ON document_access_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert access logs"
  ON document_access_log FOR INSERT
  WITH CHECK (true);

-- Function to log document access
CREATE OR REPLACE FUNCTION log_document_access(
  p_document_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO document_access_log (document_id, user_id, action, ip_address, user_agent)
  VALUES (p_document_id, p_user_id, p_action, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
