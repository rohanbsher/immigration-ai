-- Migration: Fix RLS security issues
-- 1. Add authorization to soft_delete_case() and restore_case()
-- 2. Restrict document_access_log INSERT policy
--
-- Context:
--   soft_delete_case() and restore_case() are SECURITY DEFINER functions
--   granted to all authenticated users. Without internal authorization checks,
--   any authenticated user can soft-delete or restore any case. This migration
--   adds ownership/admin verification inside the function body.
--
--   The document_access_log INSERT policy used WITH CHECK (true), allowing
--   any authenticated user to insert log entries with arbitrary user_id values.
--   This is tightened to require user_id = auth.uid().

-- ============================================================================
-- 1. Fix soft_delete_case() - require case ownership or admin role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_case(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attorney_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Get the case attorney
  SELECT attorney_id INTO v_attorney_id
  FROM public.cases
  WHERE id = p_case_id AND deleted_at IS NULL;

  IF v_attorney_id IS NULL THEN
    RAISE EXCEPTION 'Case not found or already deleted';
  END IF;

  -- Get caller's role
  SELECT role::TEXT INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Authorization: must be case attorney or admin
  IF auth.uid() != v_attorney_id AND v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only the case attorney or an admin can delete this case';
  END IF;

  -- Soft delete the case
  UPDATE public.cases SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_case_id AND deleted_at IS NULL;

  -- Soft delete associated documents
  UPDATE public.documents SET deleted_at = NOW(), updated_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NULL;

  -- Soft delete associated forms
  UPDATE public.forms SET deleted_at = NOW(), updated_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NULL;
END;
$$;

-- ============================================================================
-- 2. Fix restore_case() - require case ownership or admin role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.restore_case(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attorney_id UUID;
  v_caller_role TEXT;
BEGIN
  -- Get the case attorney (from soft-deleted cases)
  SELECT attorney_id INTO v_attorney_id
  FROM public.cases
  WHERE id = p_case_id AND deleted_at IS NOT NULL;

  IF v_attorney_id IS NULL THEN
    RAISE EXCEPTION 'Case not found or not deleted';
  END IF;

  -- Get caller's role
  SELECT role::TEXT INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Authorization: must be case attorney or admin
  IF auth.uid() != v_attorney_id AND v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only the case attorney or an admin can restore this case';
  END IF;

  -- Restore the case
  UPDATE public.cases SET deleted_at = NULL, updated_at = NOW()
  WHERE id = p_case_id AND deleted_at IS NOT NULL;

  -- Restore associated documents
  UPDATE public.documents SET deleted_at = NULL, updated_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NOT NULL;

  -- Restore associated forms
  UPDATE public.forms SET deleted_at = NULL, updated_at = NOW()
  WHERE case_id = p_case_id AND deleted_at IS NOT NULL;
END;
$$;

-- ============================================================================
-- 3. Fix document_access_log INSERT policy
-- ============================================================================
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert access logs" ON document_access_log;

-- Create a restricted policy: users can only insert logs for themselves
CREATE POLICY "Users can insert own access logs"
  ON document_access_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
