-- Migration: 004_multitenancy.sql
-- Description: Multi-tenancy support for law firms and teams
-- Created: 2024

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE firm_role AS ENUM ('owner', 'admin', 'attorney', 'staff');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Firms table: Represents a law firm or organization
CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  logo_url TEXT,
  website TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Firm members table: Links users to firms with roles
CREATE TABLE firm_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role firm_role NOT NULL DEFAULT 'attorney',
  title TEXT,
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, user_id)
);

-- Firm invitations table: Manages team invitations
CREATE TABLE firm_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role firm_role NOT NULL DEFAULT 'attorney',
  token TEXT NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES profiles(id),
  accepted_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case assignments table: Links cases to specific team members
CREATE TABLE case_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'assigned',
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(case_id, user_id)
);

-- Add firm_id to cases table
ALTER TABLE cases ADD COLUMN firm_id UUID REFERENCES firms(id) ON DELETE SET NULL;

-- Add firm_id to profiles for quick lookup of primary firm
ALTER TABLE profiles ADD COLUMN primary_firm_id UUID REFERENCES firms(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_firms_owner_id ON firms(owner_id);
CREATE INDEX idx_firms_slug ON firms(slug);
CREATE INDEX idx_firms_subscription_id ON firms(subscription_id);
CREATE INDEX idx_firm_members_firm_id ON firm_members(firm_id);
CREATE INDEX idx_firm_members_user_id ON firm_members(user_id);
CREATE INDEX idx_firm_members_role ON firm_members(role);
CREATE INDEX idx_firm_invitations_firm_id ON firm_invitations(firm_id);
CREATE INDEX idx_firm_invitations_email ON firm_invitations(email);
CREATE INDEX idx_firm_invitations_token ON firm_invitations(token);
CREATE INDEX idx_firm_invitations_status ON firm_invitations(status);
CREATE INDEX idx_case_assignments_case_id ON case_assignments(case_id);
CREATE INDEX idx_case_assignments_user_id ON case_assignments(user_id);
CREATE INDEX idx_cases_firm_id ON cases(firm_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;

-- Firms: Members can view their firm, owners/admins can update
CREATE POLICY "Firm members can view their firm"
  ON firms FOR SELECT
  USING (
    id IN (
      SELECT firm_id FROM firm_members WHERE user_id = auth.uid()
    ) OR
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm owners can update their firm"
  ON firms FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can create firms"
  ON firms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Firm owners can delete their firm"
  ON firms FOR DELETE
  USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Firm members: Members can view other members, admins can manage
CREATE POLICY "Firm members can view other members"
  ON firm_members FOR SELECT
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can manage members"
  ON firm_members FOR INSERT
  WITH CHECK (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can update members"
  ON firm_members FOR UPDATE
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can remove members"
  ON firm_members FOR DELETE
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Firm invitations: Admins can manage invitations
CREATE POLICY "Firm admins can view invitations"
  ON firm_invitations FOR SELECT
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can create invitations"
  ON firm_invitations FOR INSERT
  WITH CHECK (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can update invitations"
  ON firm_invitations FOR UPDATE
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Firm admins can delete invitations"
  ON firm_invitations FOR DELETE
  USING (
    firm_id IN (
      SELECT firm_id FROM firm_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Case assignments: Case participants can view, attorneys can manage
CREATE POLICY "Case participants can view assignments"
  ON case_assignments FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM cases
      WHERE attorney_id = auth.uid() OR client_id = auth.uid()
    ) OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Attorneys can manage case assignments"
  ON case_assignments FOR ALL
  USING (
    case_id IN (
      SELECT id FROM cases WHERE attorney_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM firm_members fm
      JOIN cases c ON c.firm_id = fm.firm_id
      WHERE fm.user_id = auth.uid()
        AND fm.role IN ('owner', 'admin', 'attorney')
        AND c.id = case_assignments.case_id
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_firms_updated_at
  BEFORE UPDATE ON firms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_firm_members_updated_at
  BEFORE UPDATE ON firm_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_firm_invitations_updated_at
  BEFORE UPDATE ON firm_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_assignments_updated_at
  BEFORE UPDATE ON case_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate unique firm slug
CREATE OR REPLACE FUNCTION generate_firm_slug(firm_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(firm_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM firms WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to create firm with owner as member
CREATE OR REPLACE FUNCTION create_firm_with_owner(
  p_name TEXT,
  p_owner_id UUID,
  p_logo_url TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS firms AS $$
DECLARE
  v_firm firms%ROWTYPE;
  v_slug TEXT;
BEGIN
  v_slug := generate_firm_slug(p_name);

  INSERT INTO firms (name, slug, owner_id, logo_url, website, phone)
  VALUES (p_name, v_slug, p_owner_id, p_logo_url, p_website, p_phone)
  RETURNING * INTO v_firm;

  INSERT INTO firm_members (firm_id, user_id, role, title)
  VALUES (v_firm.id, p_owner_id, 'owner', 'Owner');

  UPDATE profiles SET primary_firm_id = v_firm.id WHERE id = p_owner_id;

  RETURN v_firm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_firm_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS firm_members AS $$
DECLARE
  v_invitation firm_invitations%ROWTYPE;
  v_member firm_members%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM firm_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM firm_members
    WHERE firm_id = v_invitation.firm_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this firm';
  END IF;

  INSERT INTO firm_members (firm_id, user_id, role, invited_by)
  VALUES (v_invitation.firm_id, p_user_id, v_invitation.role, v_invitation.invited_by)
  RETURNING * INTO v_member;

  UPDATE firm_invitations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = NOW()
  WHERE id = v_invitation.id;

  UPDATE profiles
  SET primary_firm_id = v_invitation.firm_id
  WHERE id = p_user_id AND primary_firm_id IS NULL;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user's role in a firm
CREATE OR REPLACE FUNCTION get_user_firm_role(p_user_id UUID, p_firm_id UUID)
RETURNS firm_role AS $$
DECLARE
  v_role firm_role;
BEGIN
  SELECT role INTO v_role
  FROM firm_members
  WHERE user_id = p_user_id AND firm_id = p_firm_id;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission in firm
CREATE OR REPLACE FUNCTION user_has_firm_permission(
  p_user_id UUID,
  p_firm_id UUID,
  p_required_roles firm_role[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role firm_role;
BEGIN
  v_role := get_user_firm_role(p_user_id, p_firm_id);

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_role = ANY(p_required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all cases accessible to a firm member
CREATE OR REPLACE FUNCTION get_firm_member_cases(p_user_id UUID, p_firm_id UUID)
RETURNS SETOF cases AS $$
DECLARE
  v_role firm_role;
BEGIN
  v_role := get_user_firm_role(p_user_id, p_firm_id);

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  IF v_role IN ('owner', 'admin', 'attorney') THEN
    RETURN QUERY
    SELECT c.* FROM cases c
    WHERE c.firm_id = p_firm_id AND c.deleted_at IS NULL;
  ELSE
    RETURN QUERY
    SELECT c.* FROM cases c
    JOIN case_assignments ca ON ca.case_id = c.id
    WHERE c.firm_id = p_firm_id
      AND ca.user_id = p_user_id
      AND c.deleted_at IS NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
