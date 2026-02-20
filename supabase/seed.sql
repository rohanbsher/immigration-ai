-- ============================================================================
-- CaseFill - Local Development Seed Data
-- ============================================================================
--
-- This file runs AFTER all migrations via `supabase db reset`.
-- It inserts synthetic test data for local development.
--
-- All PII is fictional. UUIDs are deterministic for predictable test references.
-- Idempotent: uses ON CONFLICT DO NOTHING throughout.
--
-- NOTE: We insert directly into `profiles` rather than `auth.users` because
-- the local seed runs as superuser and the handle_new_user() trigger would
-- require auth.users entries. For local dev we skip the auth layer and
-- create profiles directly. Developers can sign up via the UI to get
-- proper auth.users entries that link to these profile IDs.
-- ============================================================================


-- ============================================================================
-- 1. DETERMINISTIC UUIDs
-- ============================================================================
-- Using fixed UUIDs so foreign keys are predictable across seed runs.

-- Profiles (attorneys)
-- attorney_1: Maria Chen (firm owner)
-- attorney_2: James Nakamura (firm attorney)
DO $$ BEGIN RAISE NOTICE 'Seeding CaseFill local dev data...'; END $$;


-- ============================================================================
-- 2. PROFILES
-- ============================================================================
-- Two attorneys and three clients with synthetic data.

INSERT INTO profiles (
  id, email, role, first_name, last_name, phone,
  bar_number, firm_name, specializations,
  date_of_birth, country_of_birth, nationality, alien_number
) VALUES
  -- Attorney 1: Firm owner
  (
    'a1000000-0000-0000-0000-000000000001',
    'maria.chen@testfirm.dev',
    'attorney',
    'Maria', 'Chen', '+1-555-100-0001',
    'CA-123456', 'Test Immigration Law Group',
    ARRAY['H1B', 'EB2', 'I-485']::visa_type[],
    NULL, NULL, NULL, NULL
  ),
  -- Attorney 2: Firm member
  (
    'a1000000-0000-0000-0000-000000000002',
    'james.nakamura@testfirm.dev',
    'attorney',
    'James', 'Nakamura', '+1-555-100-0002',
    'CA-789012', 'Test Immigration Law Group',
    ARRAY['O1', 'EB1', 'L1']::visa_type[],
    NULL, NULL, NULL, NULL
  ),
  -- Client 1
  (
    'c1000000-0000-0000-0000-000000000001',
    'ananya.patel@example.dev',
    'client',
    'Ananya', 'Patel', '+1-555-200-0001',
    NULL, NULL, NULL,
    '1990-03-15', 'India', 'Indian', 'A-111222333'
  ),
  -- Client 2
  (
    'c1000000-0000-0000-0000-000000000002',
    'carlos.rivera@example.dev',
    'client',
    'Carlos', 'Rivera', '+1-555-200-0002',
    NULL, NULL, NULL,
    '1988-07-22', 'Mexico', 'Mexican', 'A-444555666'
  ),
  -- Client 3
  (
    'c1000000-0000-0000-0000-000000000003',
    'yuki.tanaka@example.dev',
    'client',
    'Yuki', 'Tanaka', '+1-555-200-0003',
    NULL, NULL, NULL,
    '1995-11-08', 'Japan', 'Japanese', 'A-777888999'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. FIRM
-- ============================================================================

INSERT INTO firms (
  id, name, slug, owner_id, phone, website, settings
) VALUES (
  'f1000000-0000-0000-0000-000000000001',
  'Test Immigration Law Group',
  'test-law-group',
  'a1000000-0000-0000-0000-000000000001',
  '+1-555-100-9999',
  'https://testfirm.dev',
  '{"timezone": "America/Los_Angeles", "default_language": "en"}'
)
ON CONFLICT (id) DO NOTHING;

-- Link attorneys' primary_firm_id
UPDATE profiles
SET primary_firm_id = 'f1000000-0000-0000-0000-000000000001'
WHERE id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002'
)
  AND primary_firm_id IS NULL;


-- ============================================================================
-- 4. FIRM MEMBERS
-- ============================================================================

INSERT INTO firm_members (id, firm_id, user_id, role, title) VALUES
  (
    'fm100000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'owner',
    'Managing Partner'
  ),
  (
    'fm100000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'attorney',
    'Senior Associate'
  )
ON CONFLICT (firm_id, user_id) DO NOTHING;


-- ============================================================================
-- 5. CASES
-- ============================================================================
-- Five cases across different visa types and statuses.

INSERT INTO cases (
  id, attorney_id, client_id, firm_id,
  visa_type, status, title, description,
  priority_date, deadline, notes
) VALUES
  -- Case 1: H-1B in document collection
  (
    'ca100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'H1B', 'document_collection',
    'Patel H-1B Petition - FY2027',
    'Initial H-1B cap filing for software engineer position at TechCorp Inc.',
    '2026-03-01', '2026-04-01',
    'Employer petition. LCA already certified.'
  ),
  -- Case 2: I-485 in review
  (
    'ca100000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'I-485', 'in_review',
    'Rivera Adjustment of Status',
    'Family-based AOS through US citizen spouse. I-130 already approved.',
    '2025-06-15', '2026-06-15',
    'Waiting for biometrics appointment.'
  ),
  -- Case 3: EB-2 filed
  (
    'ca100000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    'EB2', 'filed',
    'Tanaka EB-2 NIW Petition',
    'National Interest Waiver petition for research scientist.',
    '2025-09-10', '2026-12-31',
    'Strong publication record. Filed with premium processing.'
  ),
  -- Case 4: O-1 in intake
  (
    'ca100000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'O1', 'intake',
    'Patel O-1A Extraordinary Ability',
    'O-1A petition for individual with extraordinary ability in sciences.',
    NULL, '2026-08-01',
    'Initial consultation completed. Gathering evidence.'
  ),
  -- Case 5: N-400 approved
  (
    'ca100000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'N-400', 'approved',
    'Rivera Naturalization Application',
    'Application for naturalization. Client has met 5-year residency requirement.',
    '2024-01-20', '2025-12-01',
    'Oath ceremony scheduled.'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 6. DOCUMENTS
-- ============================================================================
-- Sample document metadata (file_url points to fake storage paths).

INSERT INTO documents (
  id, case_id, uploaded_by,
  document_type, status,
  file_name, file_url, file_size, mime_type,
  ai_extracted_data, ai_confidence_score
) VALUES
  -- Passport for Case 1
  (
    'd1000000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'passport', 'analyzed',
    'patel_passport.pdf', '/storage/test/patel_passport.pdf',
    2048000, 'application/pdf',
    '{"full_name": "Ananya Patel", "passport_number": "Z1234567", "expiration": "2032-03-14", "country": "India"}',
    0.95
  ),
  -- Employment letter for Case 1
  (
    'd1000000-0000-0000-0000-000000000002',
    'ca100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'employment_letter', 'verified',
    'techcorp_offer_letter.pdf', '/storage/test/techcorp_offer.pdf',
    1024000, 'application/pdf',
    '{"employer": "TechCorp Inc.", "position": "Senior Software Engineer", "salary": "$145,000"}',
    0.92
  ),
  -- Birth certificate for Case 2
  (
    'd1000000-0000-0000-0000-000000000003',
    'ca100000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'birth_certificate', 'verified',
    'rivera_birth_cert.pdf', '/storage/test/rivera_birth_cert.pdf',
    512000, 'application/pdf',
    '{"full_name": "Carlos Rivera", "date_of_birth": "1988-07-22", "place_of_birth": "Mexico City"}',
    0.89
  ),
  -- Diploma for Case 3
  (
    'd1000000-0000-0000-0000-000000000004',
    'ca100000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000003',
    'diploma', 'analyzed',
    'tanaka_phd_diploma.pdf', '/storage/test/tanaka_diploma.pdf',
    3072000, 'application/pdf',
    '{"institution": "University of Tokyo", "degree": "Ph.D. in Molecular Biology", "year": "2020"}',
    0.97
  ),
  -- I-94 for Case 1
  (
    'd1000000-0000-0000-0000-000000000005',
    'ca100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'i94', 'uploaded',
    'patel_i94.pdf', '/storage/test/patel_i94.pdf',
    256000, 'application/pdf',
    NULL, NULL
  ),
  -- Recommendation letter for Case 3
  (
    'd1000000-0000-0000-0000-000000000006',
    'ca100000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000003',
    'recommendation_letter', 'uploaded',
    'tanaka_recommendation_prof_smith.pdf', '/storage/test/tanaka_rec.pdf',
    768000, 'application/pdf',
    NULL, NULL
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 7. FORMS
-- ============================================================================
-- Sample forms: 2 drafts, 1 ai_filled.

INSERT INTO forms (
  id, case_id, form_type, status,
  form_data, ai_filled_data, ai_confidence_scores
) VALUES
  -- I-129 draft for Case 1
  (
    'fo100000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    'I-129', 'draft',
    '{"petitioner_name": "TechCorp Inc.", "beneficiary_name": "Ananya Patel"}',
    NULL, NULL
  ),
  -- I-485 draft for Case 2
  (
    'fo100000-0000-0000-0000-000000000002',
    'ca100000-0000-0000-0000-000000000002',
    'I-485', 'draft',
    '{"applicant_name": "Carlos Rivera"}',
    NULL, NULL
  ),
  -- I-140 ai_filled for Case 3
  (
    'fo100000-0000-0000-0000-000000000003',
    'ca100000-0000-0000-0000-000000000003',
    'I-140', 'ai_filled',
    '{}',
    '{"petitioner_name": "Yuki Tanaka", "classification": "EB-2 NIW", "field_of_endeavor": "Molecular Biology"}',
    '{"petitioner_name": 0.98, "classification": 0.99, "field_of_endeavor": 0.95}'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 8. TASKS
-- ============================================================================
-- Three tasks with different statuses and priorities.

INSERT INTO tasks (
  id, case_id, firm_id, created_by, assigned_to,
  title, description, status, priority, due_date
) VALUES
  -- Pending task: collect employer documents
  (
    't1000000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    NULL,
    'a1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Collect employer support documents',
    'Request LCA certification copy, company financials, and org chart from TechCorp HR.',
    'pending', 'high',
    '2026-03-10'
  ),
  -- In-progress task: review medical exam
  (
    't1000000-0000-0000-0000-000000000002',
    'ca100000-0000-0000-0000-000000000002',
    NULL,
    'a1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002',
    'Review medical exam results',
    'Verify I-693 form is complete and signed by authorized civil surgeon.',
    'in_progress', 'medium',
    '2026-03-15'
  ),
  -- Completed task: gather recommendation letters
  (
    't1000000-0000-0000-0000-000000000003',
    'ca100000-0000-0000-0000-000000000003',
    NULL,
    'a1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'Gather recommendation letters',
    'Obtain at least 5 recommendation letters from independent experts in the field.',
    'completed', 'high',
    '2026-02-01'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 9. BILLING: CUSTOMER + SUBSCRIPTION
-- ============================================================================
-- Free-tier subscription for the primary attorney.

INSERT INTO customers (
  id, user_id, email, name
) VALUES (
  'cu100000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'maria.chen@testfirm.dev',
  'Maria Chen'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO subscriptions (
  id, customer_id, stripe_subscription_id,
  plan_type, status, billing_period,
  current_period_start, current_period_end
) VALUES (
  'su100000-0000-0000-0000-000000000001',
  'cu100000-0000-0000-0000-000000000001',
  NULL,
  'free', 'active', 'monthly',
  DATE_TRUNC('month', NOW()),
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
)
ON CONFLICT (id) DO NOTHING;

-- Link the firm to its subscription
UPDATE firms
SET subscription_id = 'su100000-0000-0000-0000-000000000001'
WHERE id = 'f1000000-0000-0000-0000-000000000001'
  AND subscription_id IS NULL;


-- ============================================================================
-- 10. NOTIFICATIONS
-- ============================================================================

INSERT INTO notifications (
  id, user_id, title, message, type, read
) VALUES
  (
    'n1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'New document uploaded',
    'Ananya Patel uploaded a passport scan for the H-1B case.',
    'info', FALSE
  ),
  (
    'n1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'Case deadline approaching',
    'The H-1B filing deadline for Patel is in 30 days.',
    'warning', FALSE
  ),
  (
    'n1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'Task assigned to you',
    'Maria Chen assigned you the task: Review medical exam results.',
    'info', TRUE
  ),
  (
    'n1000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000001',
    'Case status update',
    'Your H-1B case is now in the Document Collection phase.',
    'info', FALSE
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 11. CONVERSATIONS
-- ============================================================================

INSERT INTO conversations (
  id, user_id, case_id, title
) VALUES
  (
    'cv100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    'H-1B Filing Strategy'
  ),
  (
    'cv100000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'ca100000-0000-0000-0000-000000000003',
    'EB-2 NIW Evidence Review'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO conversation_messages (
  id, conversation_id, role, content
) VALUES
  (
    'cm100000-0000-0000-0000-000000000001',
    'cv100000-0000-0000-0000-000000000001',
    'user',
    'What documents do we still need for the H-1B cap filing?'
  ),
  (
    'cm100000-0000-0000-0000-000000000002',
    'cv100000-0000-0000-0000-000000000001',
    'assistant',
    'Based on the case file, you still need: (1) the certified LCA copy, (2) company financial statements, and (3) an organizational chart showing the position.'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 12. ACTIVITIES
-- ============================================================================

INSERT INTO activities (
  id, case_id, user_id, activity_type, description, metadata
) VALUES
  (
    'ac100000-0000-0000-0000-000000000001',
    'ca100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'case_created',
    'Case created: Patel H-1B Petition - FY2027',
    '{"visa_type": "H1B"}'
  ),
  (
    'ac100000-0000-0000-0000-000000000002',
    'ca100000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'document_uploaded',
    'Passport scan uploaded by Ananya Patel',
    '{"document_type": "passport", "file_name": "patel_passport.pdf"}'
  ),
  (
    'ac100000-0000-0000-0000-000000000003',
    'ca100000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'document_analyzed',
    'AI analysis complete for passport with 95% confidence',
    '{"document_type": "passport", "confidence": 0.95}'
  ),
  (
    'ac100000-0000-0000-0000-000000000004',
    'ca100000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'status_changed',
    'Case status changed from document_collection to in_review',
    '{"old_status": "document_collection", "new_status": "in_review"}'
  ),
  (
    'ac100000-0000-0000-0000-000000000005',
    'ca100000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'form_ai_filled',
    'I-140 form auto-filled by AI with high confidence',
    '{"form_type": "I-140", "avg_confidence": 0.97}'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- Done
-- ============================================================================
DO $$ BEGIN RAISE NOTICE 'Seed data inserted successfully.'; END $$;
