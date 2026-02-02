-- Migration: 028_security_fixes.sql
-- Fixes security and error handling issues in migrations 022 and 027
--
-- FIXES:
-- 1. Add SECURITY DEFINER to quota functions (027) - Required for RLS bypass
-- 2. Add exception handling to cascade_soft_delete (022) - Prevents cascade failure from breaking main operation

-- ============================================================================
-- FIX 1: SECURITY DEFINER on quota functions
-- ============================================================================
-- These functions query subscriptions/customers tables which have RLS.
-- Without SECURITY DEFINER, the trigger would fail when a user tries to
-- create a case/document because they can't read the subscription table.

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

-- Update comments to reflect SECURITY DEFINER
COMMENT ON FUNCTION check_case_quota() IS
  'Enforces case quota limits at database level. Uses SECURITY DEFINER to bypass RLS when reading subscriptions.';
COMMENT ON FUNCTION check_document_quota() IS
  'Enforces document quota limits at database level. Uses SECURITY DEFINER to bypass RLS when reading subscriptions.';

-- ============================================================================
-- FIX 2: Exception handling in cascade_soft_delete
-- ============================================================================
-- If the cascade fails (e.g., a child table doesn't exist or has issues),
-- we don't want to fail the parent soft-delete operation. Log and continue.

CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Cascading soft delete: parent -> children
  IF TG_TABLE_NAME = 'cases' THEN
    -- SOFT DELETE: Case is being soft-deleted
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      -- Category A: Cascade soft-delete to audit-critical children
      UPDATE documents SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE forms SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE tasks SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE case_messages SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE document_requests SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;

      -- Category C: Hard-delete transient data (no legal value after case closure)
      DELETE FROM scheduled_emails WHERE case_id = NEW.id;
      DELETE FROM deadline_alerts WHERE case_id = NEW.id;

      -- Category B: activities and case_assignments are intentionally NOT touched
      -- They are the immutable audit trail and should remain visible for compliance

      -- Category D: conversations have SET NULL FK - handled by PostgreSQL automatically

    -- RESTORE: Case is being restored (deleted_at set back to NULL)
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      -- Only restore children that were deleted at the same time as the case
      UPDATE documents SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE forms SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE tasks SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE case_messages SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE document_requests SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;

      -- Note: scheduled_emails and deadline_alerts were hard-deleted and cannot be restored
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the parent operation
    -- The case soft-delete should still succeed even if cascade has issues
    RAISE WARNING 'Soft delete cascade error for case %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cascade_soft_delete() IS
  'Cascades soft delete from cases to children. Soft-deletes audit-critical tables (documents, forms, tasks, case_messages, document_requests). Hard-deletes transient tables (scheduled_emails, deadline_alerts). Leaves activities/case_assignments visible for audit compliance. Has exception handling to prevent cascade failures from breaking the main operation.';
