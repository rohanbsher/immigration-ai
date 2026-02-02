-- Migration: 023_fix_cascade_delete.sql
-- Description: Fix soft delete vs hard delete mismatch for child tables
-- Problem: Cases use soft delete (deleted_at), but Forms/Documents/Tasks use ON DELETE CASCADE.
--          Restoring a case loses all child records permanently.
-- Solution: Change to SET NULL and implement soft delete cascade via trigger.
-- Created: 2024

-- ============================================================================
-- ADD DELETED_AT COLUMNS TO CHILD TABLES
-- ============================================================================

-- Forms already has deleted_at based on the service code, but ensure it exists
ALTER TABLE forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Documents already has deleted_at based on the service code, but ensure it exists
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Tasks table - add deleted_at if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================================
-- CREATE INDEXES FOR SOFT DELETE QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON forms(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- ADD DELETED_AT TO CASES TABLE IF NOT EXISTS
-- ============================================================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- CREATE SOFT DELETE CASCADE FUNCTION
-- ============================================================================

-- Function to cascade soft delete from cases to child tables
CREATE OR REPLACE FUNCTION cascade_case_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when deleted_at changes from NULL to a timestamp
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete all forms belonging to this case
    UPDATE forms
    SET deleted_at = NEW.deleted_at
    WHERE case_id = NEW.id AND deleted_at IS NULL;

    -- Soft delete all documents belonging to this case
    UPDATE documents
    SET deleted_at = NEW.deleted_at
    WHERE case_id = NEW.id AND deleted_at IS NULL;

    -- Soft delete all tasks belonging to this case
    UPDATE tasks
    SET deleted_at = NEW.deleted_at
    WHERE case_id = NEW.id AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for case soft delete cascade
DROP TRIGGER IF EXISTS trigger_cascade_case_soft_delete ON cases;
CREATE TRIGGER trigger_cascade_case_soft_delete
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION cascade_case_soft_delete();

-- ============================================================================
-- CREATE SOFT DELETE RESTORE FUNCTION
-- ============================================================================

-- Function to restore soft deleted child records when case is restored
CREATE OR REPLACE FUNCTION cascade_case_restore()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when deleted_at changes from a timestamp to NULL
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    -- Restore all forms that were deleted at the same time as the case
    UPDATE forms
    SET deleted_at = NULL
    WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;

    -- Restore all documents that were deleted at the same time as the case
    UPDATE documents
    SET deleted_at = NULL
    WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;

    -- Restore all tasks that were deleted at the same time as the case
    UPDATE tasks
    SET deleted_at = NULL
    WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for case restore cascade
DROP TRIGGER IF EXISTS trigger_cascade_case_restore ON cases;
CREATE TRIGGER trigger_cascade_case_restore
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL)
  EXECUTE FUNCTION cascade_case_restore();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cascade_case_soft_delete() IS
  'Automatically soft-deletes child records (forms, documents, tasks) when a case is soft-deleted';

COMMENT ON FUNCTION cascade_case_restore() IS
  'Automatically restores child records when a case is restored from soft-delete';

COMMENT ON TRIGGER trigger_cascade_case_soft_delete ON cases IS
  'Trigger to cascade soft delete to child records';

COMMENT ON TRIGGER trigger_cascade_case_restore ON cases IS
  'Trigger to cascade restore to child records';
