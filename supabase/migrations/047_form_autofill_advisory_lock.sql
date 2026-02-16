-- Migration: Atomic form autofill lock
-- Prevents race condition where two concurrent autofill requests both
-- "recover" a stuck form and start autofilling simultaneously.
-- Uses pg_advisory_xact_lock to serialize autofill per form.
--
-- LOCK STRATEGY:
--   Uses two-argument pg_advisory_xact_lock(classid, objid) with a fixed
--   namespace constant (200002) to avoid collisions with other advisory
--   lock users (e.g., 2FA rate limiting uses 200001). The objid is derived
--   from the form UUID's first 8 hex chars.

CREATE OR REPLACE FUNCTION try_start_form_autofill(
  p_form_id UUID,
  p_allowed_statuses TEXT[] DEFAULT ARRAY['draft', 'ai_filled', 'in_review', 'needs_review', 'rejected']
)
RETURNS TABLE(acquired BOOLEAN, current_status TEXT) AS $$
DECLARE
  v_status TEXT;
  v_updated_at TIMESTAMPTZ;
  v_lock_key INTEGER;
BEGIN
  -- Derive a lock key from the UUID's first 8 hex characters.
  v_lock_key := ('x' || left(replace(p_form_id::text, '-', ''), 8))::bit(32)::integer;

  -- Two-arg advisory lock: namespace 200002 separates form locks from
  -- other advisory lock users.
  PERFORM pg_advisory_xact_lock(200002, v_lock_key);

  -- Read current form state (under lock, so no races)
  SELECT f.status, f.updated_at INTO v_status, v_updated_at
  FROM forms f
  WHERE f.id = p_form_id AND f.deleted_at IS NULL;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT;
    RETURN;
  END IF;

  -- Handle stuck autofilling forms (>5 min old)
  IF v_status = 'autofilling' THEN
    IF v_updated_at < NOW() - INTERVAL '5 minutes' THEN
      -- Reset stuck form (AND status = 'autofilling' guards against
      -- a legitimate transition completing between SELECT and UPDATE)
      UPDATE forms SET status = 'draft', updated_at = NOW()
      WHERE id = p_form_id AND status = 'autofilling';
      v_status := 'draft';
    ELSE
      -- Actively being autofilled by another request
      RETURN QUERY SELECT FALSE, 'autofilling'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check if current status allows autofill
  IF NOT (v_status = ANY(p_allowed_statuses)) THEN
    RETURN QUERY SELECT FALSE, v_status;
    RETURN;
  END IF;

  -- Atomically set status to autofilling
  UPDATE forms
  SET status = 'autofilling', updated_at = NOW()
  WHERE id = p_form_id;

  RETURN QUERY SELECT TRUE, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION try_start_form_autofill(UUID, TEXT[]) TO authenticated;
