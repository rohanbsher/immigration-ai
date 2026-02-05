-- Migration: 032_fix_document_quota_per_case.sql
-- Purpose: Fix document quota to enforce per-case limits (matching maxDocumentsPerCase)
--
-- SEMANTIC FIX: Previous trigger counted total documents per user, but the limit
-- is named maxDocumentsPerCase. This migration fixes the trigger to enforce
-- documents per case, not total documents.
--
-- Before: Free user could have 100 total docs across all cases
-- After: Free user can have 10 docs PER CASE (matching limits.ts and UI)

-- Drop the old trigger first
DROP TRIGGER IF EXISTS enforce_document_quota ON documents;

-- Replace the document quota function with per-case enforcement
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

  -- Count documents in THIS CASE only (not total across all cases)
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

  -- Handle NULL result (no subscription found)
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Set limits based on plan (matches limits.ts maxDocumentsPerCase values)
  max_allowed := CASE user_plan
    WHEN 'free' THEN 10
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN -1  -- unlimited
    ELSE 10
  END;

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

-- Recreate the trigger
CREATE TRIGGER enforce_document_quota
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_quota();

-- Add index for efficient per-case document counting
CREATE INDEX IF NOT EXISTS idx_documents_case_id_active
  ON documents(case_id)
  WHERE deleted_at IS NULL;

-- Update comment to reflect new behavior
COMMENT ON FUNCTION check_document_quota() IS
  'Enforces document quota limits PER CASE at database level. Uses SECURITY DEFINER to bypass RLS on subscriptions table. Limits: free=10, pro=50, enterprise=unlimited per case.';
