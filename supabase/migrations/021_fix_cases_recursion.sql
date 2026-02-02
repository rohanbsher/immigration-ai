-- Migration: 021_fix_cases_recursion.sql
-- Description: Fix infinite recursion in cases and case_assignments RLS policies
--
-- Root Cause Analysis:
-- Chain 1: cases → profiles → cases (via "Attorneys can view client profiles")
-- Chain 2: cases → case_assignments → cases
--
-- Solution: Use SECURITY DEFINER functions that bypass RLS for cross-table checks

-- ============================================================================
-- CREATE NEW HELPER FUNCTIONS
-- ============================================================================

-- Function to get case IDs user is assigned to (bypasses RLS)
CREATE OR REPLACE FUNCTION get_assigned_case_ids(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(case_id), ARRAY[]::UUID[])
  FROM case_assignments
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user can access a specific case (bypasses RLS)
-- This checks direct ownership, admin status, and firm membership
CREATE OR REPLACE FUNCTION can_access_case(p_user_id UUID, p_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_case RECORD;
BEGIN
  -- Get case details directly (bypassing RLS)
  SELECT attorney_id, client_id, firm_id, deleted_at
  INTO v_case
  FROM cases
  WHERE id = p_case_id;

  IF v_case IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check deleted
  IF v_case.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Check direct ownership
  IF v_case.attorney_id = p_user_id OR v_case.client_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check admin status (using existing function)
  IF is_system_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check firm membership for non-staff (owner, admin, attorney see all firm cases)
  IF v_case.firm_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM firm_members
      WHERE user_id = p_user_id
        AND firm_id = v_case.firm_id
        AND role IN ('owner', 'admin', 'attorney')
    ) THEN
      RETURN TRUE;
    END IF;

    -- Staff only see assigned cases
    IF EXISTS (
      SELECT 1 FROM firm_members fm
      JOIN case_assignments ca ON ca.user_id = fm.user_id
      WHERE fm.user_id = p_user_id
        AND fm.firm_id = v_case.firm_id
        AND fm.role = 'staff'
        AND ca.case_id = p_case_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is attorney for a specific client (bypasses RLS)
-- Used by profiles policies to avoid querying cases directly
CREATE OR REPLACE FUNCTION is_attorney_for_client(p_attorney_id UUID, p_client_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE attorney_id = p_attorney_id
      AND client_id = p_client_id
      AND deleted_at IS NULL
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- FIX CASES TABLE POLICIES
-- ============================================================================

-- Drop all existing case policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view accessible cases" ON cases;
DROP POLICY IF EXISTS "Authorized users can create cases" ON cases;
DROP POLICY IF EXISTS "Authorized users can update cases" ON cases;
DROP POLICY IF EXISTS "Authorized users can soft delete cases" ON cases;
DROP POLICY IF EXISTS "Admins can view all cases" ON cases;

-- Cases: Users can view cases they're involved in or firm cases they have access to
-- Uses SECURITY DEFINER functions to avoid recursion
CREATE POLICY "Users can view accessible cases"
  ON cases FOR SELECT
  USING (
    deleted_at IS NULL AND (
      -- Direct ownership/involvement
      attorney_id = auth.uid() OR
      client_id = auth.uid() OR
      -- Admin access (using SECURITY DEFINER function)
      is_system_admin(auth.uid()) OR
      -- Firm-based access for non-staff (owner, admin, attorney)
      (
        firm_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM firm_members
          WHERE firm_id = cases.firm_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin', 'attorney')
        )
      ) OR
      -- Staff can see assigned cases only (using SECURITY DEFINER function)
      id = ANY(get_assigned_case_ids(auth.uid()))
    )
  );

-- Cases: Attorneys and firm members with appropriate roles can create cases
CREATE POLICY "Authorized users can create cases"
  ON cases FOR INSERT
  WITH CHECK (
    -- Direct attorney
    (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'attorney') AND
      attorney_id = auth.uid()
    ) OR
    -- Firm member with create permission (using SECURITY DEFINER function)
    (
      firm_id IS NOT NULL AND
      is_user_in_firm(auth.uid(), firm_id) AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'attorney')
      )
    ) OR
    -- Admin (using SECURITY DEFINER function)
    is_system_admin(auth.uid())
  );

-- Cases: Users can update their own cases or firm cases they have access to
CREATE POLICY "Authorized users can update cases"
  ON cases FOR UPDATE
  USING (
    -- Direct ownership
    attorney_id = auth.uid() OR
    -- Firm-based update access
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'attorney')
      )
    ) OR
    -- Admin (using SECURITY DEFINER function)
    is_system_admin(auth.uid())
  );

-- Cases: Attorneys can soft delete their cases
CREATE POLICY "Authorized users can soft delete cases"
  ON cases FOR DELETE
  USING (
    -- Direct ownership
    attorney_id = auth.uid() OR
    -- Firm-based delete access (owner/admin only)
    (
      firm_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM firm_members
        WHERE firm_id = cases.firm_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    ) OR
    -- Admin (using SECURITY DEFINER function)
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX CASE_ASSIGNMENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Case participants can view assignments" ON case_assignments;
DROP POLICY IF EXISTS "Attorneys can manage case assignments" ON case_assignments;

-- Case assignments: Use SECURITY DEFINER function to check case access
CREATE POLICY "Case participants can view assignments"
  ON case_assignments FOR SELECT
  USING (
    -- User is the assigned person
    user_id = auth.uid() OR
    -- User can access the case (using SECURITY DEFINER function)
    can_access_case(auth.uid(), case_id) OR
    -- Admin access
    is_system_admin(auth.uid())
  );

-- Case assignments: Attorneys and firm attorneys can manage assignments
CREATE POLICY "Attorneys can manage case assignments"
  ON case_assignments FOR ALL
  USING (
    -- Case attorney can manage
    can_access_case(auth.uid(), case_id) OR
    -- Admin access
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX PROFILES TABLE POLICIES
-- ============================================================================

-- Drop and recreate the problematic "Attorneys can view client profiles" policy
DROP POLICY IF EXISTS "Attorneys can view client profiles" ON profiles;

-- Attorneys can view their clients' profiles (using SECURITY DEFINER function)
CREATE POLICY "Attorneys can view client profiles"
  ON profiles FOR SELECT
  USING (
    is_attorney_for_client(auth.uid(), id)
  );

-- ============================================================================
-- FIX DOCUMENTS TABLE POLICIES
-- ============================================================================

-- Documents also query cases, so let's fix them too
DROP POLICY IF EXISTS "Users can view accessible documents" ON documents;

CREATE POLICY "Users can view accessible documents"
  ON documents FOR SELECT
  USING (
    -- User uploaded the document
    uploaded_by = auth.uid() OR
    -- User can access the case (using SECURITY DEFINER function)
    can_access_case(auth.uid(), case_id) OR
    -- Admin access
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX FORMS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authorized users can view forms" ON forms;
DROP POLICY IF EXISTS "Attorneys can manage forms" ON forms;

CREATE POLICY "Authorized users can view forms"
  ON forms FOR SELECT
  USING (
    can_access_case(auth.uid(), case_id) OR
    is_system_admin(auth.uid())
  );

CREATE POLICY "Attorneys can manage forms"
  ON forms FOR ALL
  USING (
    can_access_case(auth.uid(), case_id) OR
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX ACTIVITIES TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authorized users can view activities" ON activities;

CREATE POLICY "Authorized users can view activities"
  ON activities FOR SELECT
  USING (
    -- User owns the activity
    user_id = auth.uid() OR
    -- User can access the case (using SECURITY DEFINER function)
    can_access_case(auth.uid(), case_id) OR
    -- Admin access
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_assigned_case_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_attorney_for_client(UUID, UUID) TO authenticated;
