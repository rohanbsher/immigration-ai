-- Migration: Soft delete enforcement triggers
-- Prevents accidental hard DELETE on cases, documents, and forms.
-- Instead of deleting, sets deleted_at timestamp.
-- Hard deletes are only allowed via the bypass function for admin cleanup.

-- Generic soft delete trigger function
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- If the row already has deleted_at set, allow the hard delete
  -- (this is the cleanup path for already-soft-deleted records)
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Instead of deleting, set deleted_at
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = NOW() WHERE id = $1',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
  ) USING OLD.id;

  -- Return NULL to cancel the DELETE
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
