-- Migration: 010_fix_firm_members_recursion.sql
-- Description: Fix infinite recursion in firm_members RLS policies
-- The issue: Policies on firm_members were querying firm_members, causing recursion

-- ============================================================================
-- CREATE HELPER FUNCTION (SECURITY DEFINER bypasses RLS)
-- ============================================================================

-- Function to get user's firm IDs (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION get_user_firm_ids(p_user_id UUID)
RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(firm_id), ARRAY[]::UUID[])
  FROM firm_members
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is in a specific firm
CREATE OR REPLACE FUNCTION is_user_in_firm(p_user_id UUID, p_firm_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM firm_members
    WHERE user_id = p_user_id AND firm_id = p_firm_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is firm admin/owner
CREATE OR REPLACE FUNCTION is_user_firm_admin(p_user_id UUID, p_firm_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM firm_members
    WHERE user_id = p_user_id
      AND firm_id = p_firm_id
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- DROP AND RECREATE FIRM_MEMBERS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Firm members can view other members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can manage members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can update members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can remove members" ON firm_members;

-- SELECT: Members can view other members in their firms
CREATE POLICY "Firm members can view other members"
  ON firm_members FOR SELECT
  USING (
    firm_id = ANY(get_user_firm_ids(auth.uid())) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT: Firm admins can add members
CREATE POLICY "Firm admins can manage members"
  ON firm_members FOR INSERT
  WITH CHECK (
    is_user_firm_admin(auth.uid(), firm_id) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE: Firm admins can update, users can update their own
CREATE POLICY "Firm admins can update members"
  ON firm_members FOR UPDATE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: Firm admins can remove, users can remove themselves
CREATE POLICY "Firm admins can remove members"
  ON firm_members FOR DELETE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- FIX FIRMS POLICIES (also had recursion)
-- ============================================================================

DROP POLICY IF EXISTS "Firm members can view their firm" ON firms;
DROP POLICY IF EXISTS "Firm owners can update their firm" ON firms;

CREATE POLICY "Firm members can view their firm"
  ON firms FOR SELECT
  USING (
    id = ANY(get_user_firm_ids(auth.uid())) OR
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm owners can update their firm"
  ON firms FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    is_user_firm_admin(auth.uid(), id) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- FIX FIRM_INVITATIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Firm admins can view invitations" ON firm_invitations;
DROP POLICY IF EXISTS "Firm admins can create invitations" ON firm_invitations;
DROP POLICY IF EXISTS "Firm admins can update invitations" ON firm_invitations;
DROP POLICY IF EXISTS "Firm admins can delete invitations" ON firm_invitations;

CREATE POLICY "Firm admins can view invitations"
  ON firm_invitations FOR SELECT
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can create invitations"
  ON firm_invitations FOR INSERT
  WITH CHECK (
    is_user_firm_admin(auth.uid(), firm_id) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can update invitations"
  ON firm_invitations FOR UPDATE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can delete invitations"
  ON firm_invitations FOR DELETE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
