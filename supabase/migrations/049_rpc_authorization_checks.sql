-- Migration: Add authorization checks to SECURITY DEFINER RPCs
--
-- PROBLEM:
--   RPCs created in migrations 046/047 are SECURITY DEFINER with
--   GRANT EXECUTE TO authenticated, but contain no authorization checks.
--   Any authenticated user can call them with arbitrary IDs, enabling:
--   - DoS on any form via try_start_form_autofill (locks form for 5 min)
--   - 2FA counter spam via check_and_record_2fa_attempt
--
-- FIX:
--   Add auth.uid() checks inside each function to verify the caller
--   is authorized for the target resource. Also adds cancel_form_autofill
--   for safe cleanup that respects advisory locks.

-- 1. Recreate check_and_record_2fa_attempt with caller verification
CREATE OR REPLACE FUNCTION check_and_record_2fa_attempt(
  p_user_id UUID,
  p_attempt_type TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(allowed BOOLEAN, recent_failures BIGINT) AS $$
DECLARE
  v_failures BIGINT;
  v_lock_key INTEGER;
BEGIN
  -- Authorization: caller must be the user being checked.
  -- auth.uid() is available after first-factor auth (aal1).
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN QUERY SELECT FALSE, -1::BIGINT;
    RETURN;
  END IF;

  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 8))::bit(32)::integer;
  PERFORM pg_advisory_xact_lock(200001, v_lock_key);

  SELECT COUNT(*) INTO v_failures
  FROM two_factor_attempts
  WHERE user_id = p_user_id
    AND success = FALSE
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_failures >= p_max_attempts THEN
    INSERT INTO two_factor_attempts (user_id, attempt_type, success)
    VALUES (p_user_id, p_attempt_type, FALSE);

    RETURN QUERY SELECT FALSE, v_failures;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_failures;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate try_start_form_autofill with attorney verification
CREATE OR REPLACE FUNCTION try_start_form_autofill(
  p_form_id UUID,
  p_allowed_statuses TEXT[] DEFAULT ARRAY['draft', 'ai_filled', 'in_review', 'needs_review', 'rejected']
)
RETURNS TABLE(acquired BOOLEAN, current_status TEXT) AS $$
DECLARE
  v_status TEXT;
  v_updated_at TIMESTAMPTZ;
  v_attorney_id UUID;
  v_lock_key INTEGER;
BEGIN
  v_lock_key := ('x' || left(replace(p_form_id::text, '-', ''), 8))::bit(32)::integer;
  PERFORM pg_advisory_xact_lock(200002, v_lock_key);

  -- Read form state AND case attorney in one query (under lock)
  SELECT f.status, f.updated_at, c.attorney_id
  INTO v_status, v_updated_at, v_attorney_id
  FROM forms f
  JOIN cases c ON c.id = f.case_id
  WHERE f.id = p_form_id AND f.deleted_at IS NULL;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'not_found'::TEXT;
    RETURN;
  END IF;

  -- Authorization: only the case's attorney can start autofill
  IF v_attorney_id IS NULL OR auth.uid() IS NULL OR v_attorney_id != auth.uid() THEN
    RETURN QUERY SELECT FALSE, 'unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Handle stuck autofilling forms (>5 min old)
  IF v_status = 'autofilling' THEN
    IF v_updated_at < NOW() - INTERVAL '5 minutes' THEN
      UPDATE forms SET status = 'draft', updated_at = NOW()
      WHERE id = p_form_id AND status = 'autofilling';
      v_status := 'draft';
    ELSE
      RETURN QUERY SELECT FALSE, 'autofilling'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT (v_status = ANY(p_allowed_statuses)) THEN
    RETURN QUERY SELECT FALSE, v_status;
    RETURN;
  END IF;

  UPDATE forms
  SET status = 'autofilling', updated_at = NOW()
  WHERE id = p_form_id;

  RETURN QUERY SELECT TRUE, v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. New function: cancel_form_autofill
-- Used by error handlers to safely reset a form from 'autofilling' status.
-- Acquires the same advisory lock as try_start_form_autofill to prevent
-- races, and verifies the caller is the case's attorney.
CREATE OR REPLACE FUNCTION cancel_form_autofill(
  p_form_id UUID,
  p_target_status TEXT DEFAULT 'draft'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_key INTEGER;
  v_attorney_id UUID;
  v_current_status TEXT;
BEGIN
  -- Validate target status: must be a status the form could have been
  -- in before autofilling started (no escalation to 'filed'/'approved')
  IF p_target_status NOT IN ('draft', 'ai_filled', 'in_review', 'needs_review', 'rejected') THEN
    RETURN FALSE;
  END IF;

  v_lock_key := ('x' || left(replace(p_form_id::text, '-', ''), 8))::bit(32)::integer;
  PERFORM pg_advisory_xact_lock(200002, v_lock_key);

  -- Read current status and verify authorization
  SELECT f.status, c.attorney_id INTO v_current_status, v_attorney_id
  FROM forms f
  JOIN cases c ON c.id = f.case_id
  WHERE f.id = p_form_id AND f.deleted_at IS NULL;

  IF v_current_status IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Authorization: only the case's attorney can cancel autofill
  IF v_attorney_id IS NULL OR auth.uid() IS NULL OR v_attorney_id != auth.uid() THEN
    RETURN FALSE;
  END IF;

  -- Only reset if currently autofilling (CAS guard)
  IF v_current_status != 'autofilling' THEN
    RETURN FALSE;
  END IF;

  UPDATE forms SET status = p_target_status, updated_at = NOW()
  WHERE id = p_form_id AND status = 'autofilling';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_form_autofill(UUID, TEXT) TO authenticated;
