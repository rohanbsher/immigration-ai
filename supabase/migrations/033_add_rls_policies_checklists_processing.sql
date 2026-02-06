-- Migration: 033_add_rls_policies_checklists_processing.sql
-- Purpose: Add missing RLS policies to document_checklists and processing_times tables
--
-- Both tables were created without RLS:
--   - document_checklists (001_initial_schema.sql) - reference data for visa document requirements
--   - processing_times (012_deadline_alerts.sql) - USCIS processing time estimates
--
-- These are reference/lookup tables that should be publicly readable but only
-- modifiable by admins.

-- ============================================================================
-- document_checklists RLS
-- ============================================================================

-- Enable RLS (was missing from 001_initial_schema.sql)
ALTER TABLE IF EXISTS document_checklists ENABLE ROW LEVEL SECURITY;

-- Guard: drop if policies already exist (idempotent)
DROP POLICY IF EXISTS "Anyone can view document checklists" ON document_checklists;
DROP POLICY IF EXISTS "Admins can manage document checklists" ON document_checklists;

-- Public can read document checklists (reference data)
CREATE POLICY "Anyone can view document checklists"
  ON document_checklists FOR SELECT
  USING (true);

-- Only admins can modify document checklists
CREATE POLICY "Admins can manage document checklists"
  ON document_checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- processing_times RLS
-- ============================================================================

-- Enable RLS (was missing from 012_deadline_alerts.sql)
ALTER TABLE IF EXISTS processing_times ENABLE ROW LEVEL SECURITY;

-- Guard: drop if policies already exist (idempotent)
DROP POLICY IF EXISTS "Anyone can view processing times" ON processing_times;
DROP POLICY IF EXISTS "Admins can manage processing times" ON processing_times;

-- Public can read processing times (reference data)
CREATE POLICY "Anyone can view processing times"
  ON processing_times FOR SELECT
  USING (true);

-- Only admins can modify processing times
CREATE POLICY "Admins can manage processing times"
  ON processing_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
