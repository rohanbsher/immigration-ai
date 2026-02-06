-- Migration: 036_email_log_unique_constraint.sql
-- Description: Add idempotency_key column with UNIQUE constraint to email_log
-- Purpose: Fixes BUG-007 race condition where concurrent Stripe webhook retries
--          could bypass the SELECT-then-UPDATE idempotency check and send
--          duplicate billing emails. The UNIQUE constraint allows atomic
--          INSERT ... ON CONFLICT detection at the database level.
-- Created: 2026-02-06

-- ============================================================================
-- ADD COLUMN
-- ============================================================================

-- Add nullable idempotency_key column. Existing rows will have NULL, which is
-- fine because NULL values are considered distinct by PostgreSQL UNIQUE
-- constraints (i.e., multiple NULLs are allowed).
ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- ============================================================================
-- UNIQUE CONSTRAINT
-- ============================================================================

-- Create the UNIQUE constraint. This is the critical piece that makes the
-- INSERT-based idempotency check atomic and race-condition-safe.
-- Using DO $$ block for idempotent migration (safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_log_idempotency_key_unique'
  ) THEN
    ALTER TABLE email_log
      ADD CONSTRAINT email_log_idempotency_key_unique UNIQUE (idempotency_key);
  END IF;
END $$;

-- ============================================================================
-- INDEX
-- ============================================================================

-- Partial index for non-null idempotency keys to speed up conflict detection
-- without bloating the index with NULL entries from legacy rows.
CREATE INDEX IF NOT EXISTS idx_email_log_idempotency_key
  ON email_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
