-- Migration: 070_storage_quota_trigger.sql
-- Purpose: Add database-level enforcement for storage quotas.
--
-- PROBLEM: Storage quota is checked at the API level before upload, but not
--          enforced atomically. Two concurrent uploads can both pass the check
--          and exceed the limit. Unlike cases/documents, there was no database
--          trigger enforcing storage limits.
-- FIX: Add check_storage_quota() trigger on documents BEFORE INSERT that
--      sums file_size per user and reads limits from plan_limits table.

-- ============================================================================
-- check_storage_quota: enforces storage limits at database level
-- ============================================================================

CREATE OR REPLACE FUNCTION check_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_bytes BIGINT;
  max_bytes BIGINT;
  user_plan TEXT;
  max_storage_gb DECIMAL;
  case_owner_id UUID;
BEGIN
  -- Get the case owner to look up their plan
  SELECT attorney_id INTO case_owner_id
  FROM cases
  WHERE id = NEW.case_id;

  IF case_owner_id IS NULL THEN
    RAISE EXCEPTION 'Case not found: %', NEW.case_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Get case owner's plan type
  SELECT COALESCE(s.plan_type, 'free') INTO user_plan
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = case_owner_id
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Read storage limit from plan_limits table (single source of truth)
  SELECT pl.max_storage_gb INTO max_storage_gb
  FROM plan_limits pl
  WHERE pl.plan_type = user_plan::plan_type;

  -- Fallback if plan_limits row is missing (25 GB)
  IF max_storage_gb IS NULL THEN
    max_storage_gb := 25.0;
  END IF;

  -- Convert GB to bytes; -1 means unlimited
  IF max_storage_gb = -1 THEN
    RETURN NEW;
  END IF;

  max_bytes := (max_storage_gb * 1024 * 1024 * 1024)::BIGINT;

  -- Sum current storage for all documents uploaded by this user
  SELECT COALESCE(SUM(file_size), 0) INTO current_bytes
  FROM documents
  WHERE uploaded_by = case_owner_id
  AND deleted_at IS NULL;

  IF (current_bytes + COALESCE(NEW.file_size, 0)) > max_bytes THEN
    RAISE EXCEPTION 'Storage quota exceeded. Current: % bytes, Max: % bytes, Upload: % bytes',
      current_bytes, max_bytes, NEW.file_size
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- ============================================================================
-- Attach trigger to documents table
-- ============================================================================

DROP TRIGGER IF EXISTS enforce_storage_quota ON documents;

CREATE TRIGGER enforce_storage_quota
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_storage_quota();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION check_storage_quota() IS
  'Enforces storage quota limits at database level. Sums file_size across all user documents and reads limits from plan_limits table (single source of truth). Uses SECURITY DEFINER to bypass RLS.';
