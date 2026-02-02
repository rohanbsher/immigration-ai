-- Migration: 026_complete_soft_delete.sql
-- Description: Completes the soft delete fix by changing CASCADE to SET NULL on FK constraints
-- Problem: Migration 023 added soft delete triggers but didn't change FK constraints.
--          If a case is hard-deleted (bypassing soft delete), CASCADE still destroys child records.
-- Solution: Change ON DELETE CASCADE to ON DELETE SET NULL for child table FKs.
-- Created: 2024

-- ============================================================================
-- CHANGE FK CONSTRAINTS FROM CASCADE TO SET NULL
-- ============================================================================

-- Forms: Change CASCADE to SET NULL
ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_case_id_fkey;
ALTER TABLE forms ADD CONSTRAINT forms_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;

-- Documents: Change CASCADE to SET NULL
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_case_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;

-- Tasks: Change CASCADE to SET NULL
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_case_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT forms_case_id_fkey ON forms IS
  'SET NULL instead of CASCADE - soft delete trigger handles child records';
COMMENT ON CONSTRAINT documents_case_id_fkey ON documents IS
  'SET NULL instead of CASCADE - soft delete trigger handles child records';
COMMENT ON CONSTRAINT tasks_case_id_fkey ON tasks IS
  'SET NULL instead of CASCADE - soft delete trigger handles child records';
