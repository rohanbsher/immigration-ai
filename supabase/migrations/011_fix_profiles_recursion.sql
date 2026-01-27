-- Migration: 011_fix_profiles_recursion.sql
-- Description: Fix infinite recursion in profiles RLS policies

-- ============================================================================
-- CREATE HELPER FUNCTION
-- ============================================================================

-- Function to check if user is system admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_system_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- FIX PROFILES POLICIES
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Attorneys can view client profiles" ON profiles;

-- Users can always view their own profile (no recursion here)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can view all profiles (using SECURITY DEFINER function)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_system_admin(auth.uid()));

-- Attorneys can view their clients' profiles
CREATE POLICY "Attorneys can view client profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.attorney_id = auth.uid()
      AND cases.client_id = profiles.id
    )
  );

-- Firm members can view other firm members' profiles
CREATE POLICY "Firm members can view firm profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM firm_members
      WHERE firm_id = ANY(get_user_firm_ids(auth.uid()))
    )
  );

-- ============================================================================
-- FIX CASES POLICIES THAT REFERENCE PROFILES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all cases" ON cases;

CREATE POLICY "Admins can view all cases"
  ON cases FOR SELECT
  USING (is_system_admin(auth.uid()));

-- ============================================================================
-- FIX DOCUMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all documents" ON documents;

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (is_system_admin(auth.uid()));

-- ============================================================================
-- FIX FORMS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all forms" ON forms;

CREATE POLICY "Admins can view all forms"
  ON forms FOR SELECT
  USING (is_system_admin(auth.uid()));
