-- Migration: Add 'needs_review' to document_status enum
-- This aligns the database enum with the TypeScript DocumentStatus type

-- PostgreSQL allows adding values to existing enums
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'needs_review' AFTER 'analyzed';

COMMENT ON TYPE document_status IS
  'Document lifecycle: uploaded -> processing -> analyzed/needs_review -> verified/rejected. expired is set externally.';
