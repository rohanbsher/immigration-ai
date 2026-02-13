-- Migration: 044_add_autofilling_form_status.sql
-- Purpose: Add 'autofilling' to form_status enum
--
-- The application code sets form status to 'autofilling' during AI autofill
-- processing (src/app/api/forms/[id]/autofill/route.ts), but the DB enum
-- was missing this value. This caused silent failures on status updates.

ALTER TYPE form_status ADD VALUE IF NOT EXISTS 'autofilling' BEFORE 'ai_filled';
