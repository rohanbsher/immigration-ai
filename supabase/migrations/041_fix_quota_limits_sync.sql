-- Migration: 041_fix_quota_limits_sync.sql
-- Purpose: Fix quota enforcement functions to read from plan_limits table
--          instead of hardcoding values, ensuring a single source of truth.
--
-- PROBLEM: check_case_quota() hardcoded free=5, enterprise=1000
--          but plan_limits table and frontend both say free=3, enterprise=unlimited(-1)
-- FIX: Both quota functions now read from plan_limits table dynamically.
--      This eliminates drift between the three places limits are defined.

-- ============================================================================
-- FIX 1: check_case_quota reads from plan_limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_case_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_plan TEXT;
BEGIN
  -- Get current count of active cases for this attorney
  SELECT COUNT(*) INTO current_count
  FROM cases
  WHERE attorney_id = NEW.attorney_id AND deleted_at IS NULL;

  -- Get user's plan type
  SELECT COALESCE(s.plan_type, 'free') INTO user_plan
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = NEW.attorney_id
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Read limit from plan_limits table (single source of truth)
  SELECT pl.max_cases INTO max_allowed
  FROM plan_limits pl
  WHERE pl.plan_type = user_plan::plan_type;

  -- Fallback if plan_limits row is missing
  IF max_allowed IS NULL THEN
    max_allowed := 3;
  END IF;

  -- Skip check for unlimited plans (-1 means unlimited)
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Case quota exceeded. Current: %, Max: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- ============================================================================
-- FIX 2: check_document_quota reads from plan_limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_document_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_plan TEXT;
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

  -- Count documents in THIS CASE only (per-case enforcement)
  SELECT COUNT(*) INTO current_count
  FROM documents
  WHERE case_id = NEW.case_id AND deleted_at IS NULL;

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

  -- Read limit from plan_limits table (single source of truth)
  SELECT pl.max_documents_per_case INTO max_allowed
  FROM plan_limits pl
  WHERE pl.plan_type = user_plan::plan_type;

  -- Fallback if plan_limits row is missing
  IF max_allowed IS NULL THEN
    max_allowed := 10;
  END IF;

  -- Skip check for unlimited plans
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Document quota exceeded for case. Current: %, Max per case: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- ============================================================================
-- Update comments
-- ============================================================================

COMMENT ON FUNCTION check_case_quota() IS
  'Enforces case quota limits at database level. Reads limits from plan_limits table (single source of truth). Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION check_document_quota() IS
  'Enforces per-case document quota limits at database level. Reads limits from plan_limits table (single source of truth). Uses SECURITY DEFINER to bypass RLS.';
