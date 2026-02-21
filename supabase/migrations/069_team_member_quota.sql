-- Migration: 069_team_member_quota.sql
-- Purpose: Add database-level enforcement for team member quotas.
--
-- PROBLEM: maxTeamMembers limit (Free: 5, Pro: 10, Enterprise: unlimited)
--          is displayed in the UI but never enforced server-side.
--          No check in invitation creation, no check on invitation acceptance,
--          and no database trigger on firm_members.
-- FIX: Add check_team_member_quota() trigger on firm_members BEFORE INSERT
--      that reads from plan_limits table (single source of truth).

-- ============================================================================
-- check_team_member_quota: enforces team member limits at database level
-- ============================================================================

CREATE OR REPLACE FUNCTION check_team_member_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  owner_id UUID;
  owner_plan TEXT;
BEGIN
  -- Get the firm owner to look up their plan
  SELECT owner_id INTO owner_id
  FROM firms
  WHERE id = NEW.firm_id AND deleted_at IS NULL;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Firm not found: %', NEW.firm_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Count current members in this firm
  SELECT COUNT(*) INTO current_count
  FROM firm_members
  WHERE firm_id = NEW.firm_id;

  -- Get firm owner's plan type
  SELECT COALESCE(s.plan_type, 'free') INTO owner_plan
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = owner_id
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF owner_plan IS NULL THEN
    owner_plan := 'free';
  END IF;

  -- Read limit from plan_limits table (single source of truth)
  SELECT pl.max_team_members INTO max_allowed
  FROM plan_limits pl
  WHERE pl.plan_type = owner_plan::plan_type;

  -- Fallback if plan_limits row is missing
  IF max_allowed IS NULL THEN
    max_allowed := 5;
  END IF;

  -- Skip check for unlimited plans (-1 means unlimited)
  IF max_allowed = -1 THEN
    RETURN NEW;
  END IF;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Team member quota exceeded for firm. Current: %, Max: %', current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- ============================================================================
-- Attach trigger to firm_members table
-- ============================================================================

DROP TRIGGER IF EXISTS enforce_team_member_quota ON firm_members;

CREATE TRIGGER enforce_team_member_quota
  BEFORE INSERT ON firm_members
  FOR EACH ROW
  EXECUTE FUNCTION check_team_member_quota();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION check_team_member_quota() IS
  'Enforces team member quota limits at database level. Reads limits from plan_limits table (single source of truth). Uses SECURITY DEFINER to bypass RLS.';
