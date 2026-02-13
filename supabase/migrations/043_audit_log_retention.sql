-- Migration: 043_audit_log_retention.sql
-- Purpose: Add retention policy for audit_log table
--
-- Legal compliance: Immigration records should be retained for 7 years.
-- This function handles cleanup of records older than the retention period.
-- IMPORTANT: Run archival to cold storage BEFORE calling this function.

-- Add index for efficient retention queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at);

-- Function to clean up old audit records in batches
-- Returns the total count of deleted records for logging
-- Uses batched deletes (default 10,000 rows) to avoid long table locks.
CREATE OR REPLACE FUNCTION cleanup_audit_log(
  p_retention_years INTEGER DEFAULT 7,
  p_batch_size INTEGER DEFAULT 10000
)
RETURNS INTEGER AS $$
DECLARE
  total_deleted INTEGER := 0;
  batch_deleted INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_retention_years || ' years')::INTERVAL;

  LOOP
    DELETE FROM audit_log
    WHERE id IN (
      SELECT id FROM audit_log
      WHERE created_at < cutoff_date
      LIMIT p_batch_size
    );

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    total_deleted := total_deleted + batch_deleted;

    EXIT WHEN batch_deleted < p_batch_size;

    -- Yield to other transactions between batches
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cleanup_audit_log(INTEGER, INTEGER) IS
  'Deletes audit_log records older than the specified retention period (default 7 years) in batches. '
  'IMPORTANT: Archive records to cold storage before calling this function. '
  'Intended to be called by a scheduled cron job.';

-- Also add cleanup for document_access_log (same retention, same batching)
CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at
  ON document_access_log(accessed_at);

CREATE OR REPLACE FUNCTION cleanup_document_access_log(
  p_retention_years INTEGER DEFAULT 7,
  p_batch_size INTEGER DEFAULT 10000
)
RETURNS INTEGER AS $$
DECLARE
  total_deleted INTEGER := 0;
  batch_deleted INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_retention_years || ' years')::INTERVAL;

  LOOP
    DELETE FROM document_access_log
    WHERE id IN (
      SELECT id FROM document_access_log
      WHERE accessed_at < cutoff_date
      LIMIT p_batch_size
    );

    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    total_deleted := total_deleted + batch_deleted;

    EXIT WHEN batch_deleted < p_batch_size;

    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cleanup_document_access_log(INTEGER, INTEGER) IS
  'Deletes document_access_log records older than the specified retention period (default 7 years) in batches. '
  'Archive records before calling.';
