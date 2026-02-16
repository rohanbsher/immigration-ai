-- Migration: Atomic form autofill lock
-- Prevents race condition where two concurrent autofill requests both
-- "recover" a stuck form and start autofilling simultaneously.
-- Uses pg_advisory_xact_lock to serialize autofill per form.

CREATE OR REPLACE FUNCTION try_start_form_autofill(
  p_form_id UUID,
  p_allowed_statuses TEXT[] DEFAULT ARRAY['draft', 'ai_filled', 'in_review', 'rejected']
)
RETURNS TABLE(acquired BOOLEAN, current_status TEXT) AS $$
DECLARE
  v_status TEXT;
  v_updated_at TIMESTAMPTZ;
  v_lock_key BIGINT;
BEGIN
  -- Derive a stable lock key from the form UUID
  v_lock_key := hashtext(p_form_id::text);

  -- Acquire an advisory lock scoped to this transaction.
  -- Only one autofill can proceed per form at a time.
  PERFORM pg_advisory_xact_lock(v_lock_key);

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
      -- Reset stuck form
      UPDATE forms SET status = 'draft', updated_at = NOW()
      WHERE id = p_form_id;
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
