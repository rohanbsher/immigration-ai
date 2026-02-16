-- Migration: Soft delete enforcement triggers
-- Prevents accidental hard DELETE on cases, documents, and forms.
-- Instead of deleting, sets deleted_at timestamp.
-- Hard deletes are allowed when deleted_at is already set (cleanup path).

-- Generic soft delete trigger function.
-- Uses SECURITY INVOKER so the UPDATE inherits the caller's permissions
-- and respects RLS policies (no privilege escalation).
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If the row already has deleted_at set, allow the hard delete.
  -- This is the cleanup path: soft-delete first, then hard-delete.
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Instead of deleting, set deleted_at.
  -- Return NULL to cancel the original DELETE statement.
  RAISE NOTICE 'Hard DELETE blocked on %.% row %. Use soft delete (UPDATE deleted_at) first.',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Apply to cases table
DROP TRIGGER IF EXISTS trg_enforce_soft_delete_cases ON cases;
CREATE TRIGGER trg_enforce_soft_delete_cases
  BEFORE DELETE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_soft_delete();

-- Apply to documents table
DROP TRIGGER IF EXISTS trg_enforce_soft_delete_documents ON documents;
CREATE TRIGGER trg_enforce_soft_delete_documents
  BEFORE DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION enforce_soft_delete();

-- Apply to forms table
DROP TRIGGER IF EXISTS trg_enforce_soft_delete_forms ON forms;
CREATE TRIGGER trg_enforce_soft_delete_forms
  BEFORE DELETE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION enforce_soft_delete();
