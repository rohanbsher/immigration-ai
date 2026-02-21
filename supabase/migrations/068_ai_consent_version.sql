-- Add AI consent version tracking to profiles table.
-- This enables versioned consent: when AI processing scope changes
-- (new providers, new data types), we bump the version and users
-- with an older version see a re-consent prompt.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_consent_version integer NOT NULL DEFAULT 0;

-- Backfill: users who already consented get version 1
UPDATE profiles
  SET ai_consent_version = 1
  WHERE ai_consent_granted_at IS NOT NULL
    AND ai_consent_version = 0;
