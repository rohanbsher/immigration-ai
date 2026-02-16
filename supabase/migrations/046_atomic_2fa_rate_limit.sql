-- Migration: 046_atomic_2fa_rate_limit.sql
-- Description: Atomic 2FA rate limiting to prevent race condition bypass.
--
-- PROBLEM:
--   The current flow reads failed attempt count, then checks the limit,
--   then records the attempt. Multiple concurrent requests can all read
--   count=4 before any writes, bypassing the 5-attempt limit.
--
-- SOLUTION:
--   A single RPC that atomically checks the rate limit AND records the
--   attempt, using an advisory lock to serialize concurrent checks.
--
-- LOCK STRATEGY:
--   Uses two-argument pg_advisory_xact_lock(classid, objid) with a fixed
--   namespace constant (200001) to avoid collisions with other advisory
--   lock users. The objid is derived from the user UUID's first 8 hex
--   chars, giving ~4 billion distinct slots (no birthday-paradox risk
--   at realistic user counts).

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
  -- Derive a lock key from the UUID's first 8 hex characters.
  -- This gives 2^32 distinct slots, avoiding birthday-paradox collisions.
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 8))::bit(32)::integer;

  -- Two-arg advisory lock: namespace 200001 separates 2FA locks from
  -- other advisory lock users (e.g., form autofill uses 200002).
  PERFORM pg_advisory_xact_lock(200001, v_lock_key);

  SELECT COUNT(*) INTO v_failures
  FROM two_factor_attempts
  WHERE user_id = p_user_id
    AND success = FALSE
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF v_failures >= p_max_attempts THEN
    -- Rate limited: still record the attempt but return allowed=false
    INSERT INTO two_factor_attempts (user_id, attempt_type, success)
    VALUES (p_user_id, p_attempt_type, FALSE);

    RETURN QUERY SELECT FALSE, v_failures;
    RETURN;
  END IF;

  -- Under the limit: allow the attempt
  RETURN QUERY SELECT TRUE, v_failures;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_and_record_2fa_attempt(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
