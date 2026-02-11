-- Add AI consent tracking column to profiles
-- Server-side enforcement: AI routes check this before sending PII to AI providers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_consent_granted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.ai_consent_granted_at
  IS 'Timestamp when user granted consent for AI processing of their data. NULL = no consent.';
