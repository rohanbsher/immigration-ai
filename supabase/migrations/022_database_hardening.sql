-- Migration: 022_database_hardening.sql
-- Description: Database performance and safety improvements
--
-- This migration addresses the following issues from the architecture analysis:
--
-- HIGH PRIORITY:
-- 1. Infinite loop risk in schedule_deadline_reminders() - Add LIMIT clause
-- 2. Deadlock risk in accept_firm_invitation() - Use advisory locks
-- 3. Deadlock risk in soft_delete_case() - Use explicit lock ordering
--
-- MEDIUM PRIORITY:
-- 4. Add composite indexes for can_access_case() performance
-- 5. Fix usage metric upsert race condition in increment_usage()
--
-- LOW PRIORITY:
-- 6. Add CHECK constraints for data integrity
-- 7. Add missing index for deadline queries

-- ============================================================================
-- 1. FIX INFINITE LOOP RISK IN schedule_deadline_reminders()
-- ============================================================================
-- The original function loops over get_upcoming_deadline_cases() without limit.
-- In edge cases (misconfigured preferences), this could iterate indefinitely.

CREATE OR REPLACE FUNCTION schedule_deadline_reminders()
RETURNS INTEGER AS $$
DECLARE
  v_case RECORD;
  v_scheduled INTEGER := 0;
  v_max_iterations CONSTANT INTEGER := 10000; -- Safety limit
BEGIN
  FOR v_case IN
    SELECT * FROM get_upcoming_deadline_cases(7)
    LIMIT v_max_iterations -- Prevent runaway loops
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM scheduled_emails
      WHERE case_id = v_case.case_id
        AND email_type = 'deadline_reminder'
        AND DATE(scheduled_for) = CURRENT_DATE
    ) THEN
      INSERT INTO scheduled_emails (
        user_id,
        case_id,
        email_type,
        scheduled_for,
        metadata
      ) VALUES (
        v_case.user_id,
        v_case.case_id,
        'deadline_reminder',
        NOW(),
        jsonb_build_object(
          'days_until', v_case.days_until,
          'deadline', v_case.deadline,
          'case_title', v_case.case_title
        )
      );
      v_scheduled := v_scheduled + 1;
    END IF;
  END LOOP;

  RETURN v_scheduled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION schedule_deadline_reminders() IS
  'Schedules deadline reminder emails for upcoming case deadlines. Limited to 10000 iterations for safety.';

-- ============================================================================
-- 2. FIX DEADLOCK RISK IN accept_firm_invitation()
-- ============================================================================
-- The original function touches 5 tables in sequence which can cause deadlocks
-- when multiple users accept invitations simultaneously.
-- Solution: Use advisory lock on firm_id to serialize invitation acceptance.

CREATE OR REPLACE FUNCTION accept_firm_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS firm_members AS $$
DECLARE
  v_invitation firm_invitations%ROWTYPE;
  v_member firm_members%ROWTYPE;
  v_lock_key BIGINT;
BEGIN
  -- First, find the invitation (without locking)
  SELECT * INTO v_invitation
  FROM firm_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Generate a lock key from firm_id (hash to bigint for pg_advisory_xact_lock)
  v_lock_key := ('x' || substr(md5(v_invitation.firm_id::text), 1, 16))::bit(64)::bigint;

  -- Acquire advisory lock for this firm (released automatically at transaction end)
  -- This serializes all invitation acceptances for the same firm
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-check invitation status after acquiring lock (could have changed)
  SELECT * INTO v_invitation
  FROM firm_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE; -- Lock the row

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM firm_members
    WHERE firm_id = v_invitation.firm_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this firm';
  END IF;

  -- Insert firm member
  INSERT INTO firm_members (firm_id, user_id, role, invited_by)
  VALUES (v_invitation.firm_id, p_user_id, v_invitation.role, v_invitation.invited_by)
  RETURNING * INTO v_member;

  -- Update invitation status
  UPDATE firm_invitations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = NOW()
  WHERE id = v_invitation.id;

  -- Update user's primary firm if not set
  UPDATE profiles
  SET primary_firm_id = v_invitation.firm_id
  WHERE id = p_user_id AND primary_firm_id IS NULL;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION accept_firm_invitation(TEXT, UUID) IS
  'Accepts a firm invitation with advisory locking to prevent deadlocks.';

-- ============================================================================
-- 3. FIX DEADLOCK RISK IN soft_delete_case()
-- ============================================================================
-- The original function updates cases, documents, forms in sequence.
-- Concurrent soft deletes on related cases could deadlock.
-- Solution: Lock in consistent order (cases first) and use explicit locking.

CREATE OR REPLACE FUNCTION soft_delete_case(p_case_id UUID)
RETURNS VOID AS $$
DECLARE
  v_case RECORD;
BEGIN
  -- Lock the case first and verify it exists and is not already deleted
  SELECT id INTO v_case
  FROM cases
  WHERE id = p_case_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_case IS NULL THEN
    RAISE EXCEPTION 'Case not found or already deleted';
  END IF;

  -- Now update in consistent order: cases -> documents -> forms
  -- All child records are locked via the case lock (they depend on case_id)

  -- Soft delete the case
  UPDATE cases SET deleted_at = NOW() WHERE id = p_case_id;

  -- Soft delete associated documents
  UPDATE documents SET deleted_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NULL;

  -- Soft delete associated forms
  UPDATE forms SET deleted_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION soft_delete_case(UUID) IS
  'Soft deletes a case and cascades to documents/forms with explicit locking.';

-- ============================================================================
-- 4. ADD COMPOSITE INDEXES FOR can_access_case() PERFORMANCE
-- ============================================================================
-- The can_access_case() function is called frequently in RLS policies.
-- These indexes optimize the most common query patterns.

-- Index for looking up cases by id with attorney/client/firm
CREATE INDEX IF NOT EXISTS idx_cases_access_check
  ON cases(id, attorney_id, client_id, firm_id, deleted_at);

-- Index for firm_members lookup by user and role
CREATE INDEX IF NOT EXISTS idx_firm_members_user_role
  ON firm_members(user_id, firm_id, role);

-- Index for case_assignments lookup (used by staff access check)
CREATE INDEX IF NOT EXISTS idx_case_assignments_user_case
  ON case_assignments(user_id, case_id);

-- Partial index for active cases with deadlines (used by deadline reminders)
CREATE INDEX IF NOT EXISTS idx_cases_active_deadline
  ON cases(deadline)
  WHERE deadline IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('completed', 'closed');

-- ============================================================================
-- 5. FIX USAGE METRIC UPSERT RACE CONDITION
-- ============================================================================
-- The original increment_usage() can race with concurrent API calls.
-- Solution: Use SELECT FOR UPDATE to lock the subscription first.

CREATE OR REPLACE FUNCTION increment_usage(
  p_subscription_id UUID,
  p_metric_name TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS usage_records AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_result usage_records%ROWTYPE;
BEGIN
  -- Lock the subscription to prevent race conditions
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF v_subscription IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Upsert usage record with conflict handling
  INSERT INTO usage_records (
    subscription_id,
    metric_name,
    quantity,
    period_start,
    period_end
  ) VALUES (
    p_subscription_id,
    p_metric_name,
    p_quantity,
    v_subscription.current_period_start,
    v_subscription.current_period_end
  )
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET
    quantity = usage_records.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_usage(UUID, TEXT, INTEGER) IS
  'Increments usage metrics with subscription locking to prevent race conditions.';

-- ============================================================================
-- 6. ADD CHECK CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Documents must have positive file size
DO $$
BEGIN
  ALTER TABLE documents ADD CONSTRAINT chk_documents_file_size_positive
    CHECK (file_size > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Constraint already exists
END $$;

-- Cases deadline must be >= priority_date (if both are set)
DO $$
BEGIN
  ALTER TABLE cases ADD CONSTRAINT chk_cases_deadline_after_priority
    CHECK (priority_date IS NULL OR deadline IS NULL OR deadline >= priority_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Firm invitations expiration must be in the future at creation
-- (Note: This only validates at insert time, not ongoing)
DO $$
BEGIN
  ALTER TABLE firm_invitations ADD CONSTRAINT chk_invitations_expires_future
    CHECK (expires_at > created_at);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Plan limits must be positive or -1 (unlimited)
DO $$
BEGIN
  ALTER TABLE plan_limits ADD CONSTRAINT chk_plan_limits_valid_cases
    CHECK (max_cases > 0 OR max_cases = -1);
  ALTER TABLE plan_limits ADD CONSTRAINT chk_plan_limits_valid_documents
    CHECK (max_documents_per_case > 0 OR max_documents_per_case = -1);
  ALTER TABLE plan_limits ADD CONSTRAINT chk_plan_limits_valid_ai_requests
    CHECK (max_ai_requests_per_month > 0 OR max_ai_requests_per_month = -1);
  ALTER TABLE plan_limits ADD CONSTRAINT chk_plan_limits_valid_storage
    CHECK (max_storage_gb > 0);
  ALTER TABLE plan_limits ADD CONSTRAINT chk_plan_limits_valid_team
    CHECK (max_team_members > 0 OR max_team_members = -1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Usage records quantity must be non-negative
DO $$
BEGIN
  ALTER TABLE usage_records ADD CONSTRAINT chk_usage_quantity_non_negative
    CHECK (quantity >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 7. ADD HELPER FUNCTION FOR LOCK ORDERING
-- ============================================================================
-- This function documents the recommended lock acquisition order
-- and can be used by developers to understand the lock hierarchy.

CREATE OR REPLACE FUNCTION get_lock_order()
RETURNS TABLE (
  priority INTEGER,
  table_name TEXT,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (VALUES
    (1, 'profiles', 'User identity - lock first'),
    (2, 'firms', 'Organization container'),
    (3, 'firm_members', 'Membership junction'),
    (4, 'firm_invitations', 'Invitation state'),
    (5, 'subscriptions', 'Billing state'),
    (6, 'cases', 'Primary work unit'),
    (7, 'case_assignments', 'Case junction'),
    (8, 'documents', 'Case children'),
    (9, 'forms', 'Case children'),
    (10, 'activities', 'Append-only log'),
    (11, 'audit_log', 'Append-only log')
  ) AS t(priority, table_name, notes)
  ORDER BY priority;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_lock_order() IS
  'Returns the recommended lock acquisition order to prevent deadlocks.';

-- ============================================================================
-- 8. ADD ANALYZE HINTS FOR QUERY PLANNER
-- ============================================================================
-- Update statistics for tables affected by new indexes

ANALYZE cases;
ANALYZE firm_members;
ANALYZE case_assignments;
ANALYZE documents;
ANALYZE forms;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_cases_access_check IS
  'Composite index for can_access_case() RLS function performance.';
COMMENT ON INDEX idx_firm_members_user_role IS
  'Index for firm membership lookups by user, firm, and role.';
COMMENT ON INDEX idx_case_assignments_user_case IS
  'Index for case assignment lookups.';
COMMENT ON INDEX idx_cases_active_deadline IS
  'Partial index for deadline reminder queries on active cases.';
