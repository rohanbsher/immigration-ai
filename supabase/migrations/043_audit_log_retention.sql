-- Migration: 043_audit_log_retention.sql
-- Purpose: Add retention policy for audit_log table
--
-- Legal compliance: Immigration records should be retained for 7 years.
-- This function handles cleanup of records older than the retention period.
-- IMPORTANT: Run archival to cold storage BEFORE calling this function.

-- Add index for efficient retention queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at);

-- Function to clean up old audit records
-- Returns the count of deleted records for logging
CREATE OR REPLACE FUNCTION cleanup_audit_log(
  p_retention_years INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_retention_years || ' years')::INTERVAL;

  DELETE FROM audit_log
  WHERE created_at < cutoff_date;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cleanup_audit_log(INTEGER) IS
  'Deletes audit_log records older than the specified retention period (default 7 years). '
  'IMPORTANT: Archive records to cold storage before calling this function. '
  'Intended to be called by a scheduled cron job.';

-- Also add cleanup for document_access_log (same retention)
CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at
  ON document_access_log(accessed_at);

CREATE OR REPLACE FUNCTION cleanup_document_access_log(
  p_retention_years INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_retention_years || ' years')::INTERVAL;

  DELETE FROM document_access_log
  WHERE accessed_at < cutoff_date;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cleanup_document_access_log(INTEGER) IS
  'Deletes document_access_log records older than the specified retention period (default 7 years). '
  'Archive records before calling.';
