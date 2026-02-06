-- Migration: 034_backfill_cases_firm_id.sql
-- Description: Backfill cases with NULL firm_id to ensure multi-tenant data safety
--
-- PROBLEM:
--   The firm_id column was added as nullable in 004_multitenancy.sql. Any cases
--   created before that migration, or created without explicitly setting firm_id,
--   have NULL firm_id. This is a multi-tenant data safety issue because:
--     1. RLS policies that filter by firm_id skip NULL rows (they become invisible)
--     2. Functions like get_firm_member_cases() exclude NULL firm_id cases
--     3. Cross-tenant data leaks can occur if firm_id is not consistently set
--
-- STRATEGY:
--   Step 1: Backfill from attorney's primary_firm_id (most reliable source)
--   Step 2: Fallback to firm_members table for attorneys without primary_firm_id
--   Step 3: Conditionally add NOT NULL constraint if all cases are backfilled
--
-- SAFETY:
--   - This migration is idempotent (safe to run multiple times)
--   - Does NOT drop any existing constraints or columns
--   - Uses DO $$ blocks for conditional logic
--   - Logs warnings for any cases that cannot be backfilled
--
-- DEPENDENCIES:
--   - 004_multitenancy.sql (firms, firm_members, firm_id on cases, primary_firm_id on profiles)
--   - 002_security_hardening.sql (deleted_at on cases)

-- ============================================================================
-- STEP 1: Backfill NULL firm_id from attorney's primary_firm_id
-- ============================================================================
-- This is the most reliable source: when a firm is created or an invitation
-- is accepted, primary_firm_id is set on the profile (see create_firm_with_owner
-- and accept_firm_invitation in 004_multitenancy.sql).

UPDATE cases
SET firm_id = profiles.primary_firm_id
FROM profiles
WHERE cases.attorney_id = profiles.id
  AND cases.firm_id IS NULL
  AND profiles.primary_firm_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Fallback to firm_members for attorneys without primary_firm_id
-- ============================================================================
-- Some attorneys may have a firm membership but no primary_firm_id set
-- (e.g., if primary_firm_id was cleared or never set during edge-case flows).
-- We pick the firm where they have the highest-privilege role.
-- Using DISTINCT ON to get exactly one firm per attorney, ordered by role
-- priority (owner > admin > attorney).

UPDATE cases
SET firm_id = fm.firm_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, firm_id
  FROM firm_members
  WHERE role IN ('owner', 'admin', 'attorney')
  ORDER BY user_id,
    CASE role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'attorney' THEN 3
    END
) fm
WHERE cases.attorney_id = fm.user_id
  AND cases.firm_id IS NULL;

-- ============================================================================
-- STEP 3: Conditionally enforce NOT NULL
-- ============================================================================
-- If all active cases now have a firm_id, it is safe to add a NOT NULL
-- constraint. If some cases still have NULL firm_id (e.g., attorneys with
-- no firm at all), we log a warning but do NOT block the migration.
--
-- NOTE: We only consider active cases (deleted_at IS NULL) because
-- soft-deleted cases are invisible to the application and should not
-- block schema improvements.

DO $$
DECLARE
  null_count INTEGER;
  total_null INTEGER;
BEGIN
  -- Count active cases with NULL firm_id
  SELECT COUNT(*) INTO null_count
  FROM cases
  WHERE firm_id IS NULL AND deleted_at IS NULL;

  -- Also count soft-deleted cases with NULL firm_id for reporting
  SELECT COUNT(*) INTO total_null
  FROM cases
  WHERE firm_id IS NULL;

  IF null_count > 0 THEN
    RAISE WARNING '[034_backfill] % active cases still have NULL firm_id (% total including soft-deleted). NOT NULL constraint NOT added. Investigate attorneys without firm membership.', null_count, total_null;
  ELSE
    IF total_null > 0 THEN
      RAISE NOTICE '[034_backfill] All active cases have firm_id. % soft-deleted cases still have NULL firm_id (acceptable).', total_null;
    END IF;

    -- All active cases have firm_id, safe to add NOT NULL constraint
    ALTER TABLE cases ALTER COLUMN firm_id SET NOT NULL;
    RAISE NOTICE '[034_backfill] NOT NULL constraint added to cases.firm_id successfully.';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Update statistics for query planner
-- ============================================================================
-- After a bulk UPDATE, the planner's statistics are stale. ANALYZE ensures
-- optimal query plans for subsequent operations.

ANALYZE cases;
