-- Migration: Add performance indexes for common case query patterns
--
-- 1. Index on visa_type for filtering cases by visa type
-- 2. Composite index on (attorney_id, status) for dashboard case lists
-- 3. Composite index on (client_id, status) for client portal case lists
-- All partial indexes exclude soft-deleted rows for efficiency.

CREATE INDEX IF NOT EXISTS idx_cases_visa_type
  ON cases(visa_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_attorney_status
  ON cases(attorney_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_client_status
  ON cases(client_id, status)
  WHERE deleted_at IS NULL;
