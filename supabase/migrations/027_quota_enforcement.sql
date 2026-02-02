-- Migration: 027_quota_enforcement.sql
-- Enforces quotas at database level to prevent race conditions
--
-- IMPORTANT: These functions use SECURITY DEFINER because they need to read
-- the subscriptions and customers tables which have RLS policies that would
-- otherwise block the trigger from seeing the user's subscription data.
-- Without SECURITY DEFINER, the quota check silently fails and defaults to 'free'.

-- ============================================================================
-- PERFORMANCE INDEXES for quota queries
-- ============================================================================

-- Fast subscription lookup per customer
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_status_created
  ON subscriptions(customer_id, status, created_at DESC)
  WHERE status IN ('active', 'trialing');

-- Fast case counting per attorney
CREATE INDEX IF NOT EXISTS idx_cases_attorney_active
  ON cases(attorney_id)
  WHERE deleted_at IS NULL;

-- Fast document counting per user
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_active
  ON documents(uploaded_by)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- QUOTA ENFORCEMENT FUNCTIONS
-- ============================================================================

-- Function to check case quota before insert
CREATE OR REPLACE FUNCTION check_case_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_plan TEXT;
BEGIN
  -- Get current count
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

  -- Handle NULL result (no subscription found)
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Set limits based on plan
  max_allowed := CASE user_plan
    WHEN 'free' THEN 5
    WHEN 'pro' THEN 50
    WHEN 'enterprise' THEN 1000
    ELSE 5
  END;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Case quota exceeded. Current: %, Max: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Trigger before case insert
DROP TRIGGER IF EXISTS enforce_case_quota ON cases;
CREATE TRIGGER enforce_case_quota
  BEFORE INSERT ON cases
  FOR EACH ROW
  EXECUTE FUNCTION check_case_quota();

-- Function to check document quota before insert
CREATE OR REPLACE FUNCTION check_document_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_plan TEXT;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM documents
  WHERE uploaded_by = NEW.uploaded_by AND deleted_at IS NULL;

  SELECT COALESCE(s.plan_type, 'free') INTO user_plan
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = NEW.uploaded_by
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Handle NULL result (no subscription found)
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  max_allowed := CASE user_plan
    WHEN 'free' THEN 100
    WHEN 'pro' THEN 1000
    WHEN 'enterprise' THEN 10000
    ELSE 100
  END;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Document quota exceeded. Current: %, Max: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Trigger before document insert
DROP TRIGGER IF EXISTS enforce_document_quota ON documents;
CREATE TRIGGER enforce_document_quota
  BEFORE INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION check_document_quota();

-- Comments
COMMENT ON FUNCTION check_case_quota() IS
  'Enforces case quota limits at database level. Uses SECURITY DEFINER to bypass RLS on subscriptions table.';
COMMENT ON FUNCTION check_document_quota() IS
  'Enforces document quota limits at database level. Uses SECURITY DEFINER to bypass RLS on subscriptions table.';
