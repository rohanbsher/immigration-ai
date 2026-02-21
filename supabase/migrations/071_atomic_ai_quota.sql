-- Migration: 071_atomic_ai_quota.sql
-- Purpose: Add atomic quota check + usage increment for AI requests.
--
-- PROBLEM: AI usage enforcement has a TOCTOU race condition.
--          enforceQuota() checks the count, then trackUsage() increments it
--          in a separate call. Concurrent requests can both pass the check.
-- FIX: New RPC check_and_increment_usage() that atomically checks quota
--      and increments usage under an advisory lock.

CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id UUID,
  p_metric_name TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_usage INTEGER,
  max_allowed INTEGER,
  new_usage INTEGER
) AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_plan_type TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_result usage_records%ROWTYPE;
BEGIN
  -- Find user's active subscription
  SELECT s.* INTO v_subscription
  FROM subscriptions s
  JOIN customers c ON s.customer_id = c.id
  WHERE c.user_id = p_user_id
  AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- No subscription = free plan with limits
  IF v_subscription IS NULL THEN
    v_plan_type := 'free';
  ELSE
    SELECT COALESCE(s.plan_type, 'free') INTO v_plan_type
    FROM subscriptions s WHERE s.id = v_subscription.id;
  END IF;

  -- Get limit from plan_limits
  IF p_metric_name = 'ai_requests' THEN
    SELECT pl.max_ai_requests_per_month INTO v_limit
    FROM plan_limits pl
    WHERE pl.plan_type = v_plan_type::plan_type;
  ELSE
    -- Fallback for other metrics (extend as needed)
    v_limit := -1;
  END IF;

  IF v_limit IS NULL THEN
    v_limit := 100; -- Safe fallback
  END IF;

  -- Unlimited plan
  IF v_limit = -1 THEN
    -- Still track usage, just don't enforce
    IF v_subscription IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(
        get_lock_namespace('usage_update'),
        hashtext(v_subscription.id::text)
      );

      INSERT INTO usage_records (subscription_id, metric_name, quantity, period_start, period_end)
      VALUES (v_subscription.id, p_metric_name, p_quantity,
              v_subscription.current_period_start, v_subscription.current_period_end)
      ON CONFLICT (subscription_id, metric_name, period_start)
      DO UPDATE SET quantity = usage_records.quantity + EXCLUDED.quantity, updated_at = NOW()
      RETURNING * INTO v_result;
    END IF;

    RETURN QUERY SELECT
      TRUE,
      COALESCE(v_result.quantity, 0),
      v_limit,
      COALESCE(v_result.quantity, 0);
    RETURN;
  END IF;

  -- No subscription means no usage records to check
  IF v_subscription IS NULL THEN
    RETURN QUERY SELECT TRUE, 0, v_limit, 0;
    RETURN;
  END IF;

  -- Acquire advisory lock for atomic check-and-increment
  PERFORM pg_advisory_xact_lock(
    get_lock_namespace('usage_update'),
    hashtext(v_subscription.id::text)
  );

  -- Get current usage within billing period
  SELECT COALESCE(ur.quantity, 0) INTO v_current
  FROM usage_records ur
  WHERE ur.subscription_id = v_subscription.id
  AND ur.metric_name = p_metric_name
  AND ur.period_start = v_subscription.current_period_start;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  -- Check if quota would be exceeded
  IF (v_current + p_quantity) > v_limit THEN
    RETURN QUERY SELECT FALSE, v_current, v_limit, v_current;
    RETURN;
  END IF;

  -- Atomically increment usage
  INSERT INTO usage_records (subscription_id, metric_name, quantity, period_start, period_end)
  VALUES (v_subscription.id, p_metric_name, p_quantity,
          v_subscription.current_period_start, v_subscription.current_period_end)
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET quantity = usage_records.quantity + EXCLUDED.quantity, updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN QUERY SELECT TRUE, v_current, v_limit, v_result.quantity;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION check_and_increment_usage(UUID, TEXT, INTEGER) IS
  'Atomically checks quota and increments usage under advisory lock. Prevents TOCTOU race condition between enforceQuota() and trackUsage().';
