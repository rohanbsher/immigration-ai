-- ==========================================================================
-- pgTAP RLS Tests: cases table
-- Tests firm isolation, role-based access, and soft-delete visibility
-- ==========================================================================
BEGIN;

SELECT plan(12);

-- --------------------------------------------------------------------------
-- Fixture UUIDs
-- --------------------------------------------------------------------------
-- Attorneys
\set att_a  '''00000000-0000-0000-0000-000000000001'''
\set att_b  '''00000000-0000-0000-0000-000000000002'''
-- Clients
\set cli_a  '''00000000-0000-0000-0000-000000000011'''
\set cli_b  '''00000000-0000-0000-0000-000000000012'''
-- Firms
\set firm_a '''00000000-0000-0000-0000-0000000000a1'''
\set firm_b '''00000000-0000-0000-0000-0000000000b1'''
-- Cases
\set case_a1 '''00000000-0000-0000-0000-00000000ca01'''
\set case_a2 '''00000000-0000-0000-0000-00000000ca02'''
\set case_b1 '''00000000-0000-0000-0000-00000000cb01'''
\set case_soft '''00000000-0000-0000-0000-00000000ca99'''

-- --------------------------------------------------------------------------
-- Insert fixtures as superuser (bypasses RLS)
-- --------------------------------------------------------------------------

-- Profiles (superuser insert avoids the handle_new_user trigger)
INSERT INTO profiles (id, email, role, first_name, last_name)
VALUES
  (:att_a,  'att-a@test.com',  'attorney', 'Alice',  'Attorney'),
  (:att_b,  'att-b@test.com',  'attorney', 'Bob',    'Attorney'),
  (:cli_a,  'cli-a@test.com',  'client',   'Carol',  'Client'),
  (:cli_b,  'cli-b@test.com',  'client',   'Dave',   'Client');

-- Firms
INSERT INTO firms (id, name, slug, owner_id)
VALUES
  (:firm_a, 'Firm Alpha', 'firm-alpha', :att_a),
  (:firm_b, 'Firm Beta',  'firm-beta',  :att_b);

-- Firm memberships
INSERT INTO firm_members (firm_id, user_id, role)
VALUES
  (:firm_a, :att_a, 'owner'),
  (:firm_b, :att_b, 'owner');

-- Cases
-- case_a1: att_a's case in firm_a, client is cli_a
-- case_a2: att_a's case in firm_a, client is cli_b (cli_b on firm_a case)
-- case_b1: att_b's case in firm_b, client is cli_b
-- case_soft: att_a's soft-deleted case
INSERT INTO cases (id, attorney_id, client_id, firm_id, visa_type, status, title)
VALUES
  (:case_a1,   :att_a, :cli_a, :firm_a, 'H1B',   'intake', 'Alpha Case 1'),
  (:case_a2,   :att_a, :cli_b, :firm_a, 'L1',    'intake', 'Alpha Case 2'),
  (:case_b1,   :att_b, :cli_b, :firm_b, 'O1',    'intake', 'Beta Case 1'),
  (:case_soft,  :att_a, :cli_a, :firm_a, 'H1B',   'closed', 'Soft Deleted Case');

UPDATE cases SET deleted_at = NOW() WHERE id = :case_soft;

-- ==========================================================================
-- Test 1: Attorney A can see their own firm's cases
-- ==========================================================================
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM cases WHERE firm_id = :firm_a),
  2,
  'Attorney A sees 2 active cases in Firm Alpha (soft-deleted excluded)'
);

-- ==========================================================================
-- Test 2: Attorney A CANNOT see Firm B cases (cross-tenant isolation)
-- ==========================================================================
SELECT is(
  (SELECT count(*)::int FROM cases WHERE firm_id = :firm_b),
  0,
  'Attorney A sees 0 cases in Firm Beta (cross-tenant isolation)'
);

-- ==========================================================================
-- Test 3: Client A can see cases where they are the client
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  EXISTS (SELECT 1 FROM cases WHERE id = :case_a1),
  'Client A can see case_a1 (they are the client)'
);

-- ==========================================================================
-- Test 4: Client A CANNOT see cases they are not party to
-- ==========================================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM cases WHERE id = :case_b1),
  'Client A cannot see case_b1 (not their case, different firm)'
);

-- ==========================================================================
-- Test 5: Client A CANNOT see case_a2 (different client on same firm)
-- ==========================================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM cases WHERE id = :case_a2),
  'Client A cannot see case_a2 (cli_b is the client, not cli_a)'
);

-- ==========================================================================
-- Test 6: Attorney can create a case (role = attorney)
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT lives_ok(
  format(
    'INSERT INTO cases (id, attorney_id, client_id, firm_id, visa_type, status, title)
     VALUES (%L, %L, %L, %L, %L, %L, %L)',
    '00000000-0000-0000-0000-00000000ca03',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-0000000000a1',
    'F1', 'intake', 'New Test Case'
  ),
  'Attorney A can create a new case in their firm'
);

-- ==========================================================================
-- Test 7: Client CANNOT create a case (role = client)
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT throws_ok(
  format(
    'INSERT INTO cases (id, attorney_id, client_id, firm_id, visa_type, status, title)
     VALUES (%L, %L, %L, %L, %L, %L, %L)',
    '00000000-0000-0000-0000-00000000ca04',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-0000000000a1',
    'H1B', 'intake', 'Client Attempt'
  ),
  NULL,
  'Client A cannot create a case (RLS blocks non-attorneys)'
);

-- ==========================================================================
-- Test 8: Attorney A can update their own case
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT lives_ok(
  format(
    'UPDATE cases SET title = %L WHERE id = %L',
    'Updated Title',
    '00000000-0000-0000-0000-00000000ca01'
  ),
  'Attorney A can update case_a1 (they are the attorney)'
);

-- ==========================================================================
-- Test 9: Attorney B CANNOT update Attorney A's cases
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM cases WHERE id = :case_a1),
  0,
  'Attorney B cannot even see case_a1 (firm isolation blocks access)'
);

-- ==========================================================================
-- Test 10: Soft-deleted cases are NOT visible to the owning attorney
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM cases WHERE id = :case_soft),
  'Soft-deleted case is not visible to its attorney'
);

-- ==========================================================================
-- Test 11: Soft-deleted cases are NOT visible to the client
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT ok(
  NOT EXISTS (SELECT 1 FROM cases WHERE id = :case_soft),
  'Soft-deleted case is not visible to its client'
);

-- ==========================================================================
-- Test 12: Attorney B can see their own firm's cases
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM cases WHERE firm_id = :firm_b),
  1,
  'Attorney B sees exactly 1 case in Firm Beta'
);

-- --------------------------------------------------------------------------
-- Cleanup
-- --------------------------------------------------------------------------
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
