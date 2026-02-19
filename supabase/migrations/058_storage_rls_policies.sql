-- Migration: 058_storage_rls_policies.sql
-- Description: Create actual RLS policies for the documents storage bucket.
-- Migration 006 documented these policies but never applied them.
-- Without these policies, authenticated users cannot upload/download documents.

-- ============================================================================
-- Fix: Update storage_extract_case_id to match actual path format
-- ============================================================================
-- The app uploads files at: {caseId}/{timestamp}-{uuid}.{ext}
-- The original function expected: documents/{case_id}/{filename}
-- This function extracts the case_id from the first path segment.

CREATE OR REPLACE FUNCTION storage_extract_case_id(path TEXT)
RETURNS UUID AS $$
DECLARE
  parts TEXT[];
  case_id TEXT;
BEGIN
  -- Split path by '/'
  parts := string_to_array(path, '/');

  -- Path format: {case_id}/{filename}
  -- The first segment is the case UUID
  IF array_length(parts, 1) >= 2 THEN
    case_id := parts[1];
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
-- Storage RLS Policies for 'documents' bucket
-- ============================================================================

-- SELECT (Download/View) - users with case access can view documents
CREATE POLICY "Users can view documents in their cases"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))
  );

-- INSERT (Upload) - users with case access can upload documents
CREATE POLICY "Users can upload documents to their cases"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))
  );

-- UPDATE (Replace) - users with case access can update documents
CREATE POLICY "Users can update documents in their cases"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documents'
    AND storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND storage_user_has_case_access(auth.uid(), storage_extract_case_id(name))
  );

-- DELETE - only attorneys/admins can delete (stricter check)
CREATE POLICY "Attorneys can delete documents in their cases"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND storage_user_can_delete_document(auth.uid(), storage_extract_case_id(name))
  );
