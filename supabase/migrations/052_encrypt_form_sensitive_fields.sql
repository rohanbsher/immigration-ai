-- Migration: 052_encrypt_form_sensitive_fields.sql
-- Purpose: Prepare forms table for application-layer encryption of PII fields
--
-- The forms.form_data (JSONB) and forms.ai_filled_data (JSONB) columns can contain
-- sensitive PII including SSNs, passport numbers, dates of birth, and A-numbers.
-- Unlike the documents table (which encrypts sensitive fields at the app layer),
-- forms currently store this data in plaintext JSONB.
--
-- Encryption strategy:
--   - Algorithm: AES-256-GCM (authenticated encryption with associated data)
--   - Encryption/decryption happens at the application layer (not DB-level)
--   - The form_data_encrypted flag tracks which rows have been migrated
--   - A backfill migration will encrypt existing rows in batches
--   - New rows will be encrypted at write time by the API layer
--
-- Why app-layer encryption (not pgcrypto):
--   1. Keys never touch the database (stored in env vars / KMS)
--   2. Decryption happens in the Node.js API layer, so DB compromise alone
--      does not expose plaintext PII
--   3. Supabase hosted Postgres does not support pgcrypto extensions on all plans
--   4. Allows key rotation without DB downtime
--
-- ROLLBACK:
/*
  DROP INDEX IF EXISTS idx_forms_data_encrypted;
  ALTER TABLE forms DROP COLUMN IF EXISTS form_data_encrypted;
*/

SET lock_timeout = '4s';

-- ============================================================================
-- ADD ENCRYPTION TRACKING COLUMN
-- ============================================================================

-- Track whether each form's sensitive JSONB fields have been encrypted.
-- false = plaintext (legacy or not yet migrated)
-- true  = form_data and ai_filled_data contain AES-256-GCM ciphertext
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS form_data_encrypted BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- INDEX FOR BACKFILL QUERIES
-- ============================================================================

-- Partial index: only indexes unencrypted rows for efficient backfill queries.
-- The backfill migration will query: WHERE form_data_encrypted = false LIMIT N
-- Once all rows are encrypted, this index becomes empty (zero storage cost).
CREATE INDEX IF NOT EXISTS idx_forms_data_encrypted
  ON forms(id)
  WHERE form_data_encrypted = false;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN forms.form_data_encrypted IS
  'Whether form_data and ai_filled_data contain AES-256-GCM encrypted ciphertext. '
  'false = plaintext (pending encryption backfill). '
  'true = encrypted at the application layer. '
  'Encryption keys are managed via environment variables, never stored in the database.';
