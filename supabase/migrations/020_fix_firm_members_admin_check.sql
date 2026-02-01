-- Migration: 020_fix_firm_members_admin_check.sql
-- Description: Fix infinite recursion in firm_members policies by using SECURITY DEFINER function
--
-- The issue: firm_members policies query profiles directly to check admin status,
-- but profiles policies query firm_members, creating infinite recursion.
--
-- Solution: Use is_system_admin() function (SECURITY DEFINER) which bypasses RLS.

-- ============================================================================
-- FIX FIRM_MEMBERS POLICIES
-- ============================================================================

-- Drop and recreate policies to use is_system_admin() instead of direct profiles query

DROP POLICY IF EXISTS "Firm members can view other members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can manage members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can update members" ON firm_members;
DROP POLICY IF EXISTS "Firm admins can remove members" ON firm_members;

-- SELECT: Members can view other members in their firms
CREATE POLICY "Firm members can view other members"
  ON firm_members FOR SELECT
  USING (
    firm_id = ANY(get_user_firm_ids(auth.uid())) OR
    is_system_admin(auth.uid())
  );

-- INSERT: Firm admins can add members
CREATE POLICY "Firm admins can manage members"
  ON firm_members FOR INSERT
  WITH CHECK (
    is_user_firm_admin(auth.uid(), firm_id) OR
    is_system_admin(auth.uid())
  );

-- UPDATE: Firm admins can update, users can update their own
CREATE POLICY "Firm admins can update members"
  ON firm_members FOR UPDATE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    user_id = auth.uid() OR
    is_system_admin(auth.uid())
  );

-- DELETE: Firm admins can remove, users can remove themselves
CREATE POLICY "Firm admins can remove members"
  ON firm_members FOR DELETE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    user_id = auth.uid() OR
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX FIRMS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Firm members can view their firm" ON firms;
DROP POLICY IF EXISTS "Firm owners can update their firm" ON firms;

CREATE POLICY "Firm members can view their firm"
  ON firms FOR SELECT
  USING (
    id = ANY(get_user_firm_ids(auth.uid())) OR
    owner_id = auth.uid() OR
    is_system_admin(auth.uid())
  );

CREATE POLICY "Firm owners can update their firm"
  ON firms FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    is_user_firm_admin(auth.uid(), id) OR
    is_system_admin(auth.uid())
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
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    is_system_admin(auth.uid())
  );

CREATE POLICY "Firm admins can create invitations"
  ON firm_invitations FOR INSERT
  WITH CHECK (
    is_user_firm_admin(auth.uid(), firm_id) OR
    is_system_admin(auth.uid())
  );

CREATE POLICY "Firm admins can update invitations"
  ON firm_invitations FOR UPDATE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    is_system_admin(auth.uid())
  );

CREATE POLICY "Firm admins can delete invitations"
  ON firm_invitations FOR DELETE
  USING (
    is_user_firm_admin(auth.uid(), firm_id) OR
    is_system_admin(auth.uid())
  );

-- ============================================================================
-- FIX TASKS POLICIES (from migration 019)
-- ============================================================================

DROP POLICY IF EXISTS "Firm members can view firm tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;

-- Use is_user_in_firm function instead of direct query
CREATE POLICY "Firm members can view firm tasks"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    firm_id IS NOT NULL AND
    is_user_in_firm(auth.uid(), firm_id)
  );

-- Use is_system_admin instead of direct profiles query
CREATE POLICY "Admins can view all tasks"
  ON tasks FOR SELECT
  USING (
    deleted_at IS NULL AND
    is_system_admin(auth.uid())
  );
