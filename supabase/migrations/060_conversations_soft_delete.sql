-- Add deleted_at column to conversations table for soft-delete support.
-- The application code already filters by deleted_at IS NULL and sets
-- deleted_at on delete — this migration adds the missing column and index.

SET lock_timeout = '4s';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: most queries filter for active (non-deleted) conversations.
-- This covers the common getById, list, and getRecentForCase queries.
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON conversations(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
