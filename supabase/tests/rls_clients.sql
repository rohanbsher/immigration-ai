-- ==========================================================================
-- pgTAP RLS Tests: profiles + firm_members (client-related access)
-- Tests own-profile access, attorney-client visibility, and firm isolation
-- ==========================================================================
BEGIN;

SELECT plan(10);

-- --------------------------------------------------------------------------
-- Fixture UUIDs
-- --------------------------------------------------------------------------
-- Attorneys
\set att_a  '''00000000-0000-0000-0000-000000000001'''
\set att_b  '''00000000-0000-0000-0000-000000000002'''
-- Clients
\set cli_a  '''00000000-0000-0000-0000-000000000011'''
\set cli_b  '''00000000-0000-0000-0000-000000000012'''
-- Unrelated user (no cases, no firm)
\set loner  '''00000000-0000-0000-0000-000000000099'''
-- Firms
\set firm_a '''00000000-0000-0000-0000-0000000000a1'''
\set firm_b '''00000000-0000-0000-0000-0000000000b1'''
-- Cases
\set case_a1 '''00000000-0000-0000-0000-00000000ca01'''
\set case_b1 '''00000000-0000-0000-0000-00000000cb01'''

-- --------------------------------------------------------------------------
-- Insert fixtures as superuser (bypasses RLS)
-- --------------------------------------------------------------------------

INSERT INTO profiles (id, email, role, first_name, last_name)
VALUES
  (:att_a,  'att-a@test.com',  'attorney', 'Alice',  'Attorney'),
  (:att_b,  'att-b@test.com',  'attorney', 'Bob',    'Attorney'),
  (:cli_a,  'cli-a@test.com',  'client',   'Carol',  'Client'),
  (:cli_b,  'cli-b@test.com',  'client',   'Dave',   'Client'),
  (:loner,  'loner@test.com',  'client',   'Eve',    'Loner');

INSERT INTO firms (id, name, slug, owner_id)
VALUES
  (:firm_a, 'Firm Alpha', 'firm-alpha', :att_a),
  (:firm_b, 'Firm Beta',  'firm-beta',  :att_b);

INSERT INTO firm_members (firm_id, user_id, role)
VALUES
  (:firm_a, :att_a, 'owner'),
  (:firm_b, :att_b, 'owner');

-- att_a has a case with cli_a; att_b has a case with cli_b
INSERT INTO cases (id, attorney_id, client_id, firm_id, visa_type, status, title)
VALUES
  (:case_a1, :att_a, :cli_a, :firm_a, 'H1B', 'intake', 'Alpha Case 1'),
  (:case_b1, :att_b, :cli_b, :firm_b, 'O1',  'intake', 'Beta Case 1');

-- ==========================================================================
-- Test 1: User can view their own profile
-- ==========================================================================
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  EXISTS (SELECT 1 FROM profiles WHERE id = :cli_a),
  'Client A can view their own profile'
);

-- ==========================================================================
-- Test 2: User can update their own profile
-- ==========================================================================
SELECT lives_ok(
  format(
    'UPDATE profiles SET first_name = %L WHERE id = %L',
    'Carolina',
    '00000000-0000-0000-0000-000000000011'
  ),
  'Client A can update their own profile'
);

-- ==========================================================================
-- Test 3: Attorney can view client profiles for cases they are assigned to
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  EXISTS (SELECT 1 FROM profiles WHERE id = :cli_a),
  'Attorney A can view Client A profile (shared case)'
);

-- ==========================================================================
-- Test 4: Attorney CANNOT view profiles of users with no shared cases
-- ==========================================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = :cli_b),
  'Attorney A cannot view Client B profile (no shared case, different firm)'
);

-- ==========================================================================
-- Test 5: Attorney CANNOT view unrelated user profile (no case, no firm)
-- ==========================================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = :loner),
  'Attorney A cannot view the loner profile (no relationship)'
);

-- ==========================================================================
-- Test 6: Client CANNOT view another client's profile
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = :cli_b),
  'Client A cannot view Client B profile'
);

-- ==========================================================================
-- Test 7: Firm members can see other firm members (via firm_members table)
-- ==========================================================================
-- Add a second attorney to firm_a so we can test firm member visibility
RESET ROLE;
INSERT INTO profiles (id, email, role, first_name, last_name)
VALUES ('00000000-0000-0000-0000-000000000003', 'att-c@test.com', 'attorney', 'Charlie', 'Attorney');
INSERT INTO firm_members (firm_id, user_id, role)
VALUES (:firm_a, '00000000-0000-0000-0000-000000000003', 'attorney');

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  EXISTS (
    SELECT 1 FROM firm_members
    WHERE firm_id = :firm_a
      AND user_id = '00000000-0000-0000-0000-000000000003'
  ),
  'Attorney A can see fellow firm_a member (Charlie) in firm_members'
);

-- ==========================================================================
-- Test 8: Firm member CANNOT see members of a different firm
-- ==========================================================================
SELECT is(
  (SELECT count(*)::int FROM firm_members WHERE firm_id = :firm_b),
  0,
  'Attorney A sees 0 members in Firm Beta (cross-firm isolation)'
);

-- ==========================================================================
-- Test 9: Firm members can view other firm member profiles
-- ==========================================================================
SELECT ok(
  EXISTS (SELECT 1 FROM profiles WHERE id = '00000000-0000-0000-0000-000000000003'),
  'Attorney A can see profile of fellow firm member Charlie'
);

-- ==========================================================================
-- Test 10: Client can view their own profile but NOT their attorney's
--          (clients are not firm members, no direct case-attorney reverse lookup)
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

-- cli_a can see their own profile
SELECT ok(
  EXISTS (SELECT 1 FROM profiles WHERE id = :cli_a)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = :att_b),
  'Client A can see own profile but NOT Attorney B profile'
);

-- --------------------------------------------------------------------------
-- Cleanup
-- --------------------------------------------------------------------------
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
