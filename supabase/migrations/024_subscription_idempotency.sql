-- Migration: 024_subscription_idempotency.sql
-- Description: Add idempotency tracking for Stripe webhook events
-- Problem: Duplicate webhooks can overwrite subscription data without version checking.
--          Webhook replay can corrupt billing state.
-- Solution: Add stripe_event_id column to track which event last updated a subscription.
-- Created: 2024

-- ============================================================================
-- ADD STRIPE_EVENT_ID COLUMN
-- ============================================================================

-- Add column to track which Stripe event last updated this subscription
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

-- Create index for event ID lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_event_id
  ON subscriptions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN subscriptions.stripe_event_id IS
  'The Stripe event ID that last updated this subscription. Used for idempotency checking to prevent duplicate webhook processing.';
