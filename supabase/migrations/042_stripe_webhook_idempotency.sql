-- Migration: 042_stripe_webhook_idempotency.sql
-- Purpose: Add table for Stripe webhook event deduplication
--
-- Prevents double-processing when Stripe retries webhook delivery.
-- Uses INSERT + UNIQUE constraint for atomic duplicate detection.

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup of old events
CREATE INDEX idx_stripe_processed_events_processed_at
  ON stripe_processed_events(processed_at);

-- RLS: Only service role can access
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage stripe events"
  ON stripe_processed_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Auto-cleanup events older than 7 days (Stripe retries max 3 days)
-- This can be called by a cron job
CREATE OR REPLACE FUNCTION cleanup_old_stripe_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stripe_processed_events
  WHERE processed_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON TABLE stripe_processed_events IS
  'Stores processed Stripe webhook event IDs for idempotency. Events older than 7 days can be cleaned up.';
