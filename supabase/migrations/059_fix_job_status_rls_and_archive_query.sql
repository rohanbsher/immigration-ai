-- Fix LOW-severity issues found in pre-production audit:
-- 1. job_status: add INSERT/UPDATE policies so non-service-role inserts fail
--    with a clear RLS violation instead of silently returning zero rows.
-- 2. archive_audit_log: replace NOT IN with NOT EXISTS to avoid O(n^2) scan
--    as the archive table grows.

SET lock_timeout = '4s';

-- ============================================================================
-- 1. job_status: explicit INSERT/UPDATE policies
-- ============================================================================
-- The worker uses service_role (bypasses RLS), so these policies only serve as
-- a safety net: if application code accidentally uses anon/authenticated roles,
-- the operation fails loudly instead of silently returning nothing.

-- Users can insert job_status rows for themselves (e.g., client-initiated jobs)
DROP POLICY IF EXISTS "Users can insert their own jobs" ON job_status;
CREATE POLICY "Users can insert their own jobs"
  ON job_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (e.g., cancellation)
DROP POLICY IF EXISTS "Users can update their own jobs" ON job_status;
CREATE POLICY "Users can update their own jobs"
  ON job_status FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. archive_audit_log: NOT IN -> NOT EXISTS
-- ============================================================================
-- NOT IN (SELECT id FROM large_table) causes a full sequential scan of the
-- archive table for every candidate row. NOT EXISTS with a correlated subquery
-- uses the primary key index and scales correctly.

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
    -- Select a batch of IDs to archive (NOT EXISTS instead of NOT IN)
    SELECT ARRAY_AGG(id) INTO batch_ids
    FROM (
      SELECT al.id FROM audit_log al
      WHERE al.changed_at < cutoff_date
      AND NOT EXISTS (
        SELECT 1 FROM audit_log_archive ala WHERE ala.id = al.id
      )
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

    -- Delete archived rows from the source table
    DELETE FROM audit_log WHERE id = ANY(batch_ids);

    total_archived := total_archived + batch_count;

    EXIT WHEN batch_count < p_batch_size;

    -- Yield to other transactions between batches
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
