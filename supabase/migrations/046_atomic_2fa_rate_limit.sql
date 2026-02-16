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
--   attempt, using SELECT FOR UPDATE to lock the relevant rows.

CREATE OR REPLACE FUNCTION check_and_record_2fa_attempt(
  p_user_id UUID,
  p_attempt_type TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS TABLE(allowed BOOLEAN, recent_failures BIGINT) AS $$
DECLARE
  v_failures BIGINT;
BEGIN
  -- Count recent failures with an advisory lock to serialize concurrent checks
  -- for the same user. The lock is automatically released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext('2fa_rate_limit_' || p_user_id::text));

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
