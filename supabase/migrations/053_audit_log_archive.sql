-- ROLLBACK:
-- DROP FUNCTION IF EXISTS archive_audit_log(INTEGER, INTEGER);
-- DROP INDEX IF EXISTS idx_audit_log_archive_changed_at;
-- DROP INDEX IF EXISTS idx_audit_log_archive_table_record;
-- DROP TABLE IF EXISTS audit_log_archive;

SET lock_timeout = '4s';

-- ============================================================================
-- Audit Log Archive Table
-- ============================================================================
-- Cold-storage table for audit_log records older than the archive threshold
-- (default 1 year). Records are moved here before cleanup_audit_log() deletes
-- records past the 7-year retention period.
--
-- Same schema as audit_log so rows can be copied with a simple INSERT...SELECT.

CREATE TABLE IF NOT EXISTS audit_log_archive (
  id UUID PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  additional_context JSONB,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying archived records
CREATE INDEX IF NOT EXISTS idx_audit_log_archive_changed_at
  ON audit_log_archive(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_archive_table_record
  ON audit_log_archive(table_name, record_id);

-- RLS: Only admins and service_role can read archived audit records
ALTER TABLE audit_log_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage archive"
  ON audit_log_archive FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view archive"
  ON audit_log_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

COMMENT ON TABLE audit_log_archive IS
  'Cold-storage archive for audit_log records. Records older than 1 year are '
  'moved here by the archival cron job before cleanup_audit_log() removes them '
  'from the live table at the 7-year retention mark.';

-- ============================================================================
-- Archive function: moves rows older than N years to audit_log_archive
-- ============================================================================
-- Uses INSERT...SELECT + batched DELETE for safe, non-blocking archival.
-- The DELETE from audit_log is allowed because it goes through
-- cleanup_audit_log() style batched deletes, which the append-only trigger
-- recognizes via the query text check.

CREATE OR REPLACE FUNCTION archive_audit_log(
  p_archive_after_years INTEGER DEFAULT 1,
  p_batch_size INTEGER DEFAULT 5000
)
RETURNS INTEGER AS $$
DECLARE
  total_archived INTEGER := 0;
  batch_count INTEGER;
  cutoff_date TIMESTAMPTZ;
  batch_ids UUID[];
BEGIN
  cutoff_date := NOW() - (p_archive_after_years || ' years')::INTERVAL;

  LOOP
    -- Select a batch of IDs to archive
    SELECT ARRAY_AGG(id) INTO batch_ids
    FROM (
      SELECT id FROM audit_log
      WHERE changed_at < cutoff_date
      AND id NOT IN (SELECT id FROM audit_log_archive)
      LIMIT p_batch_size
    ) sub;

    -- Exit if no more records to archive
    IF batch_ids IS NULL OR array_length(batch_ids, 1) IS NULL THEN
      EXIT;
    END IF;

    batch_count := array_length(batch_ids, 1);

    -- Copy to archive
    INSERT INTO audit_log_archive (
      id, table_name, record_id, operation,
      old_values, new_values, changed_by, changed_at,
      ip_address, user_agent, additional_context
    )
    SELECT
      id, table_name, record_id, operation,
      old_values, new_values, changed_by, changed_at,
      ip_address, user_agent, additional_context
    FROM audit_log
    WHERE id = ANY(batch_ids)
    ON CONFLICT (id) DO NOTHING;

    total_archived := total_archived + batch_count;

    EXIT WHEN batch_count < p_batch_size;

    -- Yield to other transactions between batches
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION archive_audit_log(INTEGER, INTEGER) IS
  'Copies audit_log records older than the specified threshold to audit_log_archive. '
  'Does NOT delete from audit_log — call cleanup_audit_log() separately for that. '
  'Uses batched operations to avoid long locks.';
