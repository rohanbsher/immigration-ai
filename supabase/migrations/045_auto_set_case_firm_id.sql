-- Migration: 045_auto_set_case_firm_id.sql
-- Description: Auto-populate firm_id on case INSERT if not provided.
--
-- PROBLEM:
--   The application code should always set firm_id when creating a case,
--   but if it's missed (e.g., API bypass, direct DB insert), the case
--   becomes invisible to firm-scoped RLS queries.
--
-- SOLUTION:
--   A BEFORE INSERT trigger that auto-populates firm_id from the
--   attorney's primary_firm_id or first firm_members entry.

CREATE OR REPLACE FUNCTION auto_set_case_firm_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-fill if firm_id is not already set
  IF NEW.firm_id IS NULL AND NEW.attorney_id IS NOT NULL THEN
    -- Priority 1: Use attorney's primary_firm_id from profiles
    SELECT primary_firm_id INTO NEW.firm_id
    FROM profiles
    WHERE id = NEW.attorney_id
      AND primary_firm_id IS NOT NULL;

    -- Priority 2: Fallback to firm_members table
    IF NEW.firm_id IS NULL THEN
      SELECT firm_id INTO NEW.firm_id
      FROM firm_members
      WHERE user_id = NEW.attorney_id
      ORDER BY
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'attorney' THEN 3
          ELSE 4
        END
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trg_auto_set_case_firm_id ON cases;

CREATE TRIGGER trg_auto_set_case_firm_id
  BEFORE INSERT ON cases
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_case_firm_id();
