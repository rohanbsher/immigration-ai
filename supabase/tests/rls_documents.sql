-- ==========================================================================
-- pgTAP RLS Tests: documents table
-- Tests case-participant access, firm isolation, and upload permissions
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
-- Firms
\set firm_a '''00000000-0000-0000-0000-0000000000a1'''
\set firm_b '''00000000-0000-0000-0000-0000000000b1'''
-- Cases
\set case_a1 '''00000000-0000-0000-0000-00000000ca01'''
\set case_b1 '''00000000-0000-0000-0000-00000000cb01'''
-- Documents
\set doc_a1 '''00000000-0000-0000-0000-0000000000d1'''
\set doc_a2 '''00000000-0000-0000-0000-0000000000d2'''
\set doc_b1 '''00000000-0000-0000-0000-0000000000d3'''

-- --------------------------------------------------------------------------
-- Insert fixtures as superuser (bypasses RLS)
-- --------------------------------------------------------------------------

INSERT INTO profiles (id, email, role, first_name, last_name)
VALUES
  (:att_a,  'att-a@test.com',  'attorney', 'Alice',  'Attorney'),
  (:att_b,  'att-b@test.com',  'attorney', 'Bob',    'Attorney'),
  (:cli_a,  'cli-a@test.com',  'client',   'Carol',  'Client'),
  (:cli_b,  'cli-b@test.com',  'client',   'Dave',   'Client');

INSERT INTO firms (id, name, slug, owner_id)
VALUES
  (:firm_a, 'Firm Alpha', 'firm-alpha', :att_a),
  (:firm_b, 'Firm Beta',  'firm-beta',  :att_b);

INSERT INTO firm_members (firm_id, user_id, role)
VALUES
  (:firm_a, :att_a, 'owner'),
  (:firm_b, :att_b, 'owner');

INSERT INTO cases (id, attorney_id, client_id, firm_id, visa_type, status, title)
VALUES
  (:case_a1, :att_a, :cli_a, :firm_a, 'H1B', 'intake', 'Alpha Case 1'),
  (:case_b1, :att_b, :cli_b, :firm_b, 'O1',  'intake', 'Beta Case 1');

-- Documents: two on case_a1, one on case_b1
INSERT INTO documents (id, case_id, uploaded_by, document_type, file_name, file_url, file_size, mime_type)
VALUES
  (:doc_a1, :case_a1, :att_a, 'passport',           'passport.pdf',      '/files/passport.pdf',      1024, 'application/pdf'),
  (:doc_a2, :case_a1, :cli_a, 'employment_letter',  'offer_letter.pdf',  '/files/offer_letter.pdf',  2048, 'application/pdf'),
  (:doc_b1, :case_b1, :att_b, 'diploma',            'diploma.pdf',       '/files/diploma.pdf',       3072, 'application/pdf');

-- ==========================================================================
-- Test 1: Attorney can see documents for their own cases
-- ==========================================================================
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents WHERE case_id = :case_a1),
  2,
  'Attorney A sees 2 documents on case_a1'
);

-- ==========================================================================
-- Test 2: Client can see documents for their own cases
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents WHERE case_id = :case_a1),
  2,
  'Client A sees 2 documents on case_a1 (they are the case client)'
);

-- ==========================================================================
-- Test 3: Attorney CANNOT see documents for cases they don't own
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents WHERE case_id = :case_b1),
  0,
  'Attorney A sees 0 documents on case_b1 (cross-firm isolation)'
);

-- ==========================================================================
-- Test 4: Client CANNOT see documents for cases they are not party to
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents WHERE case_id = :case_b1),
  0,
  'Client A sees 0 documents on case_b1 (not their case)'
);

-- ==========================================================================
-- Test 5: Client B CANNOT see documents on case_a1 (not their case)
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents WHERE case_id = :case_a1),
  0,
  'Client B sees 0 documents on case_a1 (not their case)'
);

-- ==========================================================================
-- Test 6: Case attorney can upload (INSERT) documents to their case
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT lives_ok(
  format(
    'INSERT INTO documents (id, case_id, uploaded_by, document_type, file_name, file_url, file_size, mime_type)
     VALUES (%L, %L, %L, %L, %L, %L, %s, %L)',
    '00000000-0000-0000-0000-0000000000d4',
    '00000000-0000-0000-0000-00000000ca01',
    '00000000-0000-0000-0000-000000000001',
    'tax_return', 'tax2024.pdf', '/files/tax2024.pdf', 4096, 'application/pdf'
  ),
  'Attorney A can upload a document to case_a1'
);

-- ==========================================================================
-- Test 7: Case client can upload (INSERT) documents to their case
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_a::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT lives_ok(
  format(
    'INSERT INTO documents (id, case_id, uploaded_by, document_type, file_name, file_url, file_size, mime_type)
     VALUES (%L, %L, %L, %L, %L, %L, %s, %L)',
    '00000000-0000-0000-0000-0000000000d5',
    '00000000-0000-0000-0000-00000000ca01',
    '00000000-0000-0000-0000-000000000011',
    'bank_statement', 'bank.pdf', '/files/bank.pdf', 5120, 'application/pdf'
  ),
  'Client A can upload a document to case_a1'
);

-- ==========================================================================
-- Test 8: Non-participant CANNOT upload documents to someone else's case
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT throws_ok(
  format(
    'INSERT INTO documents (id, case_id, uploaded_by, document_type, file_name, file_url, file_size, mime_type)
     VALUES (%L, %L, %L, %L, %L, %L, %s, %L)',
    '00000000-0000-0000-0000-0000000000d6',
    '00000000-0000-0000-0000-00000000ca01',
    '00000000-0000-0000-0000-000000000002',
    'passport', 'sneaky.pdf', '/files/sneaky.pdf', 1024, 'application/pdf'
  ),
  NULL,
  'Attorney B cannot upload to case_a1 (not a participant)'
);

-- ==========================================================================
-- Test 9: Unrelated client CANNOT upload documents
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :cli_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT throws_ok(
  format(
    'INSERT INTO documents (id, case_id, uploaded_by, document_type, file_name, file_url, file_size, mime_type)
     VALUES (%L, %L, %L, %L, %L, %L, %s, %L)',
    '00000000-0000-0000-0000-0000000000d7',
    '00000000-0000-0000-0000-00000000ca01',
    '00000000-0000-0000-0000-000000000012',
    'passport', 'cli_b_sneaky.pdf', '/files/cli_b.pdf', 1024, 'application/pdf'
  ),
  NULL,
  'Client B cannot upload to case_a1 (not a participant)'
);

-- ==========================================================================
-- Test 10: Attorney B sees only their own firm's documents
-- ==========================================================================
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', :att_b::text,
  'role', 'authenticated'
)::text, true);
SET ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM documents),
  1,
  'Attorney B sees only 1 document total (only from their firm)'
);

-- --------------------------------------------------------------------------
-- Cleanup
-- --------------------------------------------------------------------------
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
