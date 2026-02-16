-- Migration: Add 'needs_review' to form_status enum
-- The TypeScript code (FORM_STATUSES, FormStatus type) and RPC default
-- parameters (migrations 047, 049) reference 'needs_review', but it was
-- never added to the form_status PostgreSQL enum.
-- Migration 030 added it to document_status only.

ALTER TYPE form_status ADD VALUE IF NOT EXISTS 'needs_review' AFTER 'in_review';
