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

-- RLS: Only admins can read archived audit records.
-- NOTE: service_role bypasses RLS entirely, so no service_role policy is needed.
ALTER TABLE audit_log_archive ENABLE ROW LEVEL SECURITY;

-- INSERT is allowed for the archive function (runs as SECURITY DEFINER / service_role)
-- No INSERT policy needed for authenticated users — only the archive function inserts.

CREATE POLICY "Admins can view archive"
  ON audit_log_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- DENY: No role can update archived audit records via RLS
CREATE POLICY "Deny all updates on audit_log_archive"
  ON audit_log_archive FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

-- DENY: No role can delete archived audit records via RLS
CREATE POLICY "Deny all deletes on audit_log_archive"
  ON audit_log_archive FOR DELETE
  TO public
  USING (false);

COMMENT ON TABLE audit_log_archive IS
  'Cold-storage archive for audit_log records. Records older than 1 year are '
  'moved here by the archival cron job before cleanup_audit_log() removes them '
  'from the live table at the 7-year retention mark. '
  'Append-only: UPDATE and DELETE are denied by both RLS policies and trigger.';

-- ============================================================================
-- APPEND-ONLY TRIGGER (same protection as audit_log)
-- ============================================================================
-- Catches UPDATE/DELETE even from service_role (which bypasses RLS).

CREATE OR REPLACE FUNCTION enforce_audit_log_archive_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_log_archive is append-only: UPDATE operations are prohibited (USCIS compliance)'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_log_archive is append-only: DELETE operations are prohibited (USCIS compliance)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_audit_log_archive_append_only ON audit_log_archive;
CREATE TRIGGER trg_audit_log_archive_append_only
  BEFORE UPDATE OR DELETE ON audit_log_archive
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_log_archive_append_only();

-- ============================================================================
-- Archive function: moves rows older than N years to audit_log_archive
-- ============================================================================
-- Uses INSERT...SELECT for safe, non-blocking archival.
-- NOTE: This function does NOT delete from audit_log. Call cleanup_audit_log()
-- separately for retention-based deletion. cleanup_audit_log() sets the session
-- variable app.allow_audit_delete to bypass the append-only trigger on audit_log.

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
