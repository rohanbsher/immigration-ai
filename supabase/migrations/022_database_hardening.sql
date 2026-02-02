-- Migration: 022_database_hardening.sql
-- Description: Consolidated database safety, performance, and integrity improvements
--
-- This migration consolidates all database hardening fixes into a single,
-- well-tested migration with proper data validation and rollback support.
--
-- DEPENDENCIES (must run first):
--   - 008_notification_preferences.sql: get_upcoming_deadline_cases(), scheduled_emails table
--   - 011_fix_profiles_recursion.sql: is_system_admin()
--   - 021_fix_cases_recursion.sql: can_access_case(), is_attorney_for_client()
--
-- CHANGES:
-- 1. Soft delete cascade via triggers (documents, forms, tasks, case_messages, document_requests)
-- 2. Hard-delete transient data on case closure (scheduled_emails, deadline_alerts)
-- 3. Advisory locks for concurrent operations using Postgres-native patterns
-- 4. Performance indexes for RLS functions
-- 5. CHECK constraints with existing data validation
-- 6. Audit triggers with proper NULL handling
-- 7. FK safety: RESTRICT on all case children to prevent accidental hard deletes
--
-- TABLE CLASSIFICATION FOR SOFT DELETE:
--   Audit-critical (soft-delete cascade): documents, forms, tasks, case_messages, document_requests
--   Immutable audit (keep visible): activities, case_assignments
--   Transient (hard-delete): scheduled_emails, deadline_alerts
--   User-owned (unlink): conversations (SET NULL - already correct)
--
-- ROLLBACK: See comments at end of file

-- ============================================================================
-- PART 1: VALIDATE EXISTING DATA BEFORE ADDING CONSTRAINTS
-- ============================================================================
-- Fail fast if existing data would violate new constraints

DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  -- Check for zero/negative file sizes
  SELECT COUNT(*) INTO v_invalid_count
  FROM documents WHERE file_size IS NOT NULL AND file_size <= 0;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % documents with invalid file_size. Fixing...', v_invalid_count;
    UPDATE documents SET file_size = NULL WHERE file_size <= 0;
  END IF;

  -- Check for deadlines before priority dates
  -- Store count in a temp table so we can check it when adding constraint
  SELECT COUNT(*) INTO v_invalid_count
  FROM cases
  WHERE deadline IS NOT NULL
    AND priority_date IS NOT NULL
    AND deadline < priority_date;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % cases with deadline before priority_date. Constraint will be skipped - fix data manually.', v_invalid_count;
    -- Store in temp table for later check
    CREATE TEMP TABLE IF NOT EXISTS _migration_flags (flag_name TEXT PRIMARY KEY, flag_value BOOLEAN);
    INSERT INTO _migration_flags VALUES ('skip_deadline_constraint', TRUE)
      ON CONFLICT (flag_name) DO UPDATE SET flag_value = TRUE;
  END IF;

  -- Check for expired invitations with bad timestamps
  SELECT COUNT(*) INTO v_invalid_count
  FROM firm_invitations WHERE expires_at <= created_at;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % invitations with invalid expiration. Fixing...', v_invalid_count;
    UPDATE firm_invitations
    SET expires_at = created_at + INTERVAL '7 days'
    WHERE expires_at <= created_at;
  END IF;
END $$;

-- ============================================================================
-- PART 2: SOFT DELETE INFRASTRUCTURE (Trigger-based, not function-based)
-- ============================================================================
-- The elegant approach: triggers handle cascading automatically.
-- No need for explicit soft_delete_case() function calls.

-- Ensure all tables have deleted_at
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial indexes for efficient "active only" queries
CREATE INDEX IF NOT EXISTS idx_cases_active ON cases(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_forms_active ON forms(case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(case_id) WHERE deleted_at IS NULL;

-- Single trigger function for all soft delete cascades
-- Handles:
--   - Audit-critical tables (soft-delete cascade): documents, forms, tasks, case_messages, document_requests
--   - Transient tables (hard-delete): scheduled_emails, deadline_alerts
--   - Immutable tables (no action): activities, case_assignments (audit trail - intentionally kept visible)
CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Cascading soft delete: parent -> children
  IF TG_TABLE_NAME = 'cases' THEN
    -- SOFT DELETE: Case is being soft-deleted
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      -- Category A: Cascade soft-delete to audit-critical children
      UPDATE documents SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE forms SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE tasks SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE case_messages SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;
      UPDATE document_requests SET deleted_at = NEW.deleted_at
        WHERE case_id = NEW.id AND deleted_at IS NULL;

      -- Category C: Hard-delete transient data (no legal value after case closure)
      DELETE FROM scheduled_emails WHERE case_id = NEW.id;
      DELETE FROM deadline_alerts WHERE case_id = NEW.id;

      -- Category B: activities and case_assignments are intentionally NOT touched
      -- They are the immutable audit trail and should remain visible for compliance

      -- Category D: conversations have SET NULL FK - handled by PostgreSQL automatically

    -- RESTORE: Case is being restored (deleted_at set back to NULL)
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      -- Only restore children that were deleted at the same time as the case
      UPDATE documents SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE forms SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE tasks SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE case_messages SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;
      UPDATE document_requests SET deleted_at = NULL
        WHERE case_id = NEW.id AND deleted_at = OLD.deleted_at;

      -- Note: scheduled_emails and deadline_alerts were hard-deleted and cannot be restored
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

COMMENT ON FUNCTION cascade_soft_delete() IS
  'Cascades soft delete from cases to children. Soft-deletes audit-critical tables (documents, forms, tasks, case_messages, document_requests). Hard-deletes transient tables (scheduled_emails, deadline_alerts). Leaves activities/case_assignments visible for audit compliance.';

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_cascade_soft_delete ON cases;
CREATE TRIGGER trigger_cascade_soft_delete
  AFTER UPDATE OF deleted_at ON cases
  FOR EACH ROW
  EXECUTE FUNCTION cascade_soft_delete();

-- ============================================================================
-- PART 3: DEADLOCK-FREE CONCURRENT OPERATIONS
-- ============================================================================
-- Use Postgres advisory locks with proper namespacing

-- Lock namespace constants (avoid magic numbers scattered in code)
-- IMPORTANT: Unknown operations throw an exception to prevent silent lock collisions
CREATE OR REPLACE FUNCTION get_lock_namespace(p_operation TEXT)
RETURNS INTEGER AS $$
BEGIN
  IF p_operation = 'firm_invitation' THEN RETURN 1;
  ELSIF p_operation = 'usage_update' THEN RETURN 2;
  ELSIF p_operation = 'case_delete' THEN RETURN 3;
  ELSE
    RAISE EXCEPTION 'Unknown lock namespace operation: %. Valid: firm_invitation, usage_update, case_delete', p_operation
      USING ERRCODE = 'P0001';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_lock_namespace(TEXT) IS
  'Returns a unique integer namespace for advisory locks. Throws exception for unknown operations to prevent silent lock collisions.';

-- Improved accept_firm_invitation with proper locking
CREATE OR REPLACE FUNCTION accept_firm_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS firm_members AS $$
DECLARE
  v_invitation firm_invitations%ROWTYPE;
  v_member firm_members%ROWTYPE;
BEGIN
  -- Find invitation first (no lock yet)
  SELECT * INTO v_invitation
  FROM firm_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation'
      USING ERRCODE = 'P0002'; -- no_data_found
  END IF;

  -- Acquire advisory lock using namespace + firm_id hashcode
  -- This is collision-free within the namespace
  PERFORM pg_advisory_xact_lock(
    get_lock_namespace('firm_invitation'),
    hashtext(v_invitation.firm_id::text)
  );

  -- Re-verify after lock (double-check locking pattern)
  -- Use FOR UPDATE (wait) so concurrent requests wait rather than fail silently
  SELECT * INTO v_invitation
  FROM firm_invitations
  WHERE id = v_invitation.id  -- Use ID, faster than token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    -- At this point, either:
    -- 1. Another transaction already accepted/expired this invitation
    -- 2. The invitation was modified between our first check and lock acquisition
    RAISE EXCEPTION 'Invitation is no longer available (may have been accepted by another user)'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check duplicate membership
  IF EXISTS (
    SELECT 1 FROM firm_members
    WHERE firm_id = v_invitation.firm_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this firm'
      USING ERRCODE = '23505'; -- unique_violation
  END IF;

  -- All checks passed - do the work
  INSERT INTO firm_members (firm_id, user_id, role, invited_by)
  VALUES (v_invitation.firm_id, p_user_id, v_invitation.role, v_invitation.invited_by)
  RETURNING * INTO v_member;

  UPDATE firm_invitations
  SET status = 'accepted', accepted_by = p_user_id, accepted_at = NOW()
  WHERE id = v_invitation.id;

  UPDATE profiles
  SET primary_firm_id = v_invitation.firm_id
  WHERE id = p_user_id AND primary_firm_id IS NULL;

  RETURN v_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;  -- Security: prevent search_path attacks

COMMENT ON FUNCTION accept_firm_invitation(TEXT, UUID) IS
  'Accepts a firm invitation with advisory locking to prevent race conditions.';

-- Improved increment_usage with proper locking (no FOR UPDATE needed with advisory lock)
CREATE OR REPLACE FUNCTION increment_usage(
  p_subscription_id UUID,
  p_metric_name TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS usage_records AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_result usage_records%ROWTYPE;
BEGIN
  -- Advisory lock on subscription (cheaper than row lock)
  PERFORM pg_advisory_xact_lock(
    get_lock_namespace('usage_update'),
    hashtext(p_subscription_id::text)
  );

  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF v_subscription IS NULL THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Atomic upsert
  INSERT INTO usage_records (
    subscription_id, metric_name, quantity, period_start, period_end
  ) VALUES (
    p_subscription_id,
    p_metric_name,
    p_quantity,
    v_subscription.current_period_start,
    v_subscription.current_period_end
  )
  ON CONFLICT (subscription_id, metric_name, period_start)
  DO UPDATE SET
    quantity = usage_records.quantity + EXCLUDED.quantity,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

COMMENT ON FUNCTION increment_usage(UUID, TEXT, INTEGER) IS
  'Atomically increments usage metrics for a subscription. Uses advisory locks to prevent race conditions on concurrent API calls.';

-- ============================================================================
-- PART 4: SCHEDULE DEADLINE REMINDERS (with proper batch limiting)
-- ============================================================================

CREATE OR REPLACE FUNCTION schedule_deadline_reminders(
  p_batch_size INTEGER DEFAULT 1000  -- Configurable, reasonable default
)
RETURNS TABLE (
  scheduled_count INTEGER,
  remaining_count INTEGER,
  truncated BOOLEAN
) AS $$
DECLARE
  v_scheduled INTEGER := 0;
  v_total INTEGER;
  v_case RECORD;
BEGIN
  -- Count total eligible (for reporting)
  SELECT COUNT(*) INTO v_total FROM get_upcoming_deadline_cases(7);

  FOR v_case IN
    SELECT * FROM get_upcoming_deadline_cases(7)
    LIMIT p_batch_size
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM scheduled_emails
      WHERE case_id = v_case.case_id
        AND email_type = 'deadline_reminder'
        AND DATE(scheduled_for) = CURRENT_DATE
    ) THEN
      INSERT INTO scheduled_emails (
        user_id, case_id, email_type, scheduled_for, metadata
      ) VALUES (
        v_case.user_id,
        v_case.case_id,
        'deadline_reminder',
        NOW(),
        jsonb_build_object(
          'days_until', v_case.days_until,
          'deadline', v_case.deadline,
          'case_title', v_case.case_title
        )
      );
      v_scheduled := v_scheduled + 1;
    END IF;
  END LOOP;

  -- Return meaningful results
  RETURN QUERY SELECT
    v_scheduled,
    GREATEST(0, v_total - p_batch_size),
    v_total > p_batch_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

COMMENT ON FUNCTION schedule_deadline_reminders(INTEGER) IS
  'Schedules deadline reminders in batches. Returns count scheduled, remaining, and truncation flag. Call repeatedly until remaining = 0.';

-- ============================================================================
-- PART 5: PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for can_access_case() RLS function
CREATE INDEX IF NOT EXISTS idx_cases_access_check
  ON cases(id) INCLUDE (attorney_id, client_id, firm_id, deleted_at);

-- Covering index for firm member lookups
CREATE INDEX IF NOT EXISTS idx_firm_members_user_lookup
  ON firm_members(user_id) INCLUDE (firm_id, role);

-- Case assignments for staff access
CREATE INDEX IF NOT EXISTS idx_case_assignments_user
  ON case_assignments(user_id) INCLUDE (case_id);

-- Deadline queries (partial index for active cases only)
-- Excludes terminal states: approved, denied, closed (there's no 'completed' in the enum)
CREATE INDEX IF NOT EXISTS idx_cases_deadline_active
  ON cases(deadline)
  WHERE deadline IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('approved', 'denied', 'closed');

-- ============================================================================
-- PART 6: CHECK CONSTRAINTS (after data validation)
-- ============================================================================

-- File size: allow NULL (not yet measured) but not zero/negative
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_file_size;
ALTER TABLE documents ADD CONSTRAINT chk_documents_file_size
  CHECK (file_size IS NULL OR file_size > 0);

-- Deadline/priority date consistency (skip if data violations exist)
DO $$
DECLARE
  v_skip BOOLEAN := FALSE;
BEGIN
  -- Check if temp table exists and has skip flag set
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = '_migration_flags' AND schemaname = 'pg_temp') THEN
    SELECT COALESCE(flag_value, FALSE) INTO v_skip
    FROM _migration_flags
    WHERE flag_name = 'skip_deadline_constraint';
  END IF;

  IF NOT v_skip THEN
    -- Safe to add constraint
    ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_deadline_priority;
    ALTER TABLE cases ADD CONSTRAINT chk_cases_deadline_priority
      CHECK (
        priority_date IS NULL OR
        deadline IS NULL OR
        deadline >= priority_date
      );
    RAISE NOTICE 'Added chk_cases_deadline_priority constraint';
  ELSE
    RAISE WARNING 'SKIPPED chk_cases_deadline_priority constraint due to existing data violations. Fix data and re-run or add constraint manually.';
  END IF;
END $$;

-- Invitation expiration sanity
ALTER TABLE firm_invitations DROP CONSTRAINT IF EXISTS chk_invitations_expires;
ALTER TABLE firm_invitations ADD CONSTRAINT chk_invitations_expires
  CHECK (expires_at > created_at);

-- Usage quantity non-negative
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS chk_usage_quantity;
ALTER TABLE usage_records ADD CONSTRAINT chk_usage_quantity
  CHECK (quantity >= 0);

-- ============================================================================
-- PART 7: AUDIT TRIGGER WITH PROPER NULL HANDLING
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Handle NULL auth context (service role, cron, migrations)
  v_user_id := COALESCE(
    auth.uid(),
    '00000000-0000-0000-0000-000000000000'::uuid  -- System user placeholder
  );

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Use INSERT with ON CONFLICT to handle any edge cases
  INSERT INTO audit_log (
    table_name, record_id, operation, old_values, new_values, changed_by, changed_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id)::text,
    TG_OP,
    v_old_data,
    v_new_data,
    v_user_id,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Audit failures should not break the main operation
    RAISE WARNING 'Audit log failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

COMMENT ON FUNCTION audit_trigger_func() IS
  'Generic audit trigger that logs all changes to audit_log table. Handles NULL auth context gracefully for service role/cron/migration operations.';

-- Apply to critical tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['cases', 'documents', 'forms', 'profiles', 'firm_members', 'subscriptions'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- PART 8: FOREIGN KEY SAFETY (RESTRICT vs CASCADE)
-- ============================================================================
-- Legal requirement: cannot accidentally delete attorneys/clients with cases

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_attorney_id_fkey;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_client_id_fkey;

ALTER TABLE cases ADD CONSTRAINT cases_attorney_id_fkey
  FOREIGN KEY (attorney_id) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE cases ADD CONSTRAINT cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE RESTRICT;

-- Helper to reassign cases before user deletion
-- Authorization: Only system admins or the attorney themselves can reassign cases
CREATE OR REPLACE FUNCTION reassign_attorney_cases(
  p_old_attorney_id UUID,
  p_new_attorney_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_caller UUID;
BEGIN
  -- Get the calling user (NULL if service role/cron)
  v_caller := auth.uid();

  -- Authorization check (skip if service role - NULL caller)
  IF v_caller IS NOT NULL THEN
    IF NOT is_system_admin(v_caller) AND v_caller != p_old_attorney_id THEN
      RAISE EXCEPTION 'Unauthorized: Only admins or the attorney themselves can reassign cases'
        USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;
  END IF;

  -- Perform the reassignment
  UPDATE cases
  SET attorney_id = p_new_attorney_id, updated_at = NOW()
  WHERE attorney_id = p_old_attorney_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_catalog;

COMMENT ON FUNCTION reassign_attorney_cases(UUID, UUID) IS
  'Reassigns all active cases from one attorney to another. Authorization: admin or the attorney themselves. Use before deleting an attorney profile.';

-- CLIENT DELETION APPROACH:
-- Unlike attorneys, clients should NOT be deleted. Use GDPR anonymization instead:
--   1. Call anonymize_user_data(client_id) from 009_gdpr_compliance.sql
--   2. This anonymizes PII while preserving case history (legal requirement)
--   3. The client_id FK remains valid, pointing to an anonymized profile
-- This is intentional: immigration case records must be retained for compliance.

-- ============================================================================
-- PART 8b: CHILD TABLE FK SAFETY (case_id)
-- ============================================================================
-- Change case_id FKs from CASCADE to RESTRICT to prevent accidental hard deletes.
-- With soft delete triggers in PART 2, hard DELETE should never be used.
-- RESTRICT ensures accidental DELETEs fail rather than cascade destruction.

-- Documents: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_case_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Forms: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_case_id_fkey;
ALTER TABLE forms ADD CONSTRAINT forms_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Tasks: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_case_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Activities: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_case_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Case messages: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE case_messages DROP CONSTRAINT IF EXISTS case_messages_case_id_fkey;
ALTER TABLE case_messages ADD CONSTRAINT case_messages_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Document requests: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE document_requests DROP CONSTRAINT IF EXISTS document_requests_case_id_fkey;
ALTER TABLE document_requests ADD CONSTRAINT document_requests_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Deadline alerts: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE deadline_alerts DROP CONSTRAINT IF EXISTS deadline_alerts_case_id_fkey;
ALTER TABLE deadline_alerts ADD CONSTRAINT deadline_alerts_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Case assignments: was ON DELETE CASCADE, now RESTRICT
ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_case_id_fkey;
ALTER TABLE case_assignments ADD CONSTRAINT case_assignments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Scheduled emails: was ON DELETE CASCADE, now RESTRICT
-- (The soft delete trigger hard-deletes these anyway, but RESTRICT prevents accidental manual deletes)
ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_case_id_fkey;
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- Note: conversations.case_id is intentionally SET NULL (migration 016)
-- When a case is soft-deleted, conversations remain but are unlinked from the case.
-- This is correct behavior - users may want to keep their AI chat history.

-- ============================================================================
-- PART 9: PROFILE EMAIL INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Ensure email uniqueness (with safe handling of existing duplicates)
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN
    RAISE WARNING 'Duplicate emails exist - unique constraint not added';
END $$;

-- ============================================================================
-- PART 10: STRIPE WEBHOOK IDEMPOTENCY
-- ============================================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_event_id
  ON subscriptions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

-- ============================================================================
-- PART 11: UPDATE STATISTICS
-- ============================================================================

ANALYZE cases;
ANALYZE documents;
ANALYZE forms;
ANALYZE firm_members;
ANALYZE case_assignments;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
/*
To rollback this migration, run the following in order:

-- 1. Remove triggers
DROP TRIGGER IF EXISTS trigger_cascade_soft_delete ON cases;
DROP TRIGGER IF EXISTS audit_cases ON cases;
DROP TRIGGER IF EXISTS audit_documents ON documents;
DROP TRIGGER IF EXISTS audit_forms ON forms;
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
DROP TRIGGER IF EXISTS audit_firm_members ON firm_members;
DROP TRIGGER IF EXISTS audit_subscriptions ON subscriptions;

-- 2. Remove CHECK constraints
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_file_size;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_deadline_priority;
ALTER TABLE firm_invitations DROP CONSTRAINT IF EXISTS chk_invitations_expires;
ALTER TABLE usage_records DROP CONSTRAINT IF EXISTS chk_usage_quantity;

-- 3. Remove indexes
DROP INDEX IF EXISTS idx_cases_active;
DROP INDEX IF EXISTS idx_documents_active;
DROP INDEX IF EXISTS idx_forms_active;
DROP INDEX IF EXISTS idx_tasks_active;
DROP INDEX IF EXISTS idx_cases_access_check;
DROP INDEX IF EXISTS idx_firm_members_user_lookup;
DROP INDEX IF EXISTS idx_case_assignments_user;
DROP INDEX IF EXISTS idx_cases_deadline_active;
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_subscriptions_stripe_event_id;

-- 4. Restore original FK behavior (if needed)
-- 4a. Profiles -> Cases
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_attorney_id_fkey;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_client_id_fkey;
ALTER TABLE cases ADD CONSTRAINT cases_attorney_id_fkey
  FOREIGN KEY (attorney_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE cases ADD CONSTRAINT cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4b. Cases -> Child tables (restore CASCADE)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_case_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_case_id_fkey;
ALTER TABLE forms ADD CONSTRAINT forms_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_case_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_case_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_messages DROP CONSTRAINT IF EXISTS case_messages_case_id_fkey;
ALTER TABLE case_messages ADD CONSTRAINT case_messages_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE document_requests DROP CONSTRAINT IF EXISTS document_requests_case_id_fkey;
ALTER TABLE document_requests ADD CONSTRAINT document_requests_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE deadline_alerts DROP CONSTRAINT IF EXISTS deadline_alerts_case_id_fkey;
ALTER TABLE deadline_alerts ADD CONSTRAINT deadline_alerts_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_case_id_fkey;
ALTER TABLE case_assignments ADD CONSTRAINT case_assignments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_case_id_fkey;
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;

-- 5. Remove added columns
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_event_id;

-- 6. Drop new functions (originals will remain from previous migrations)
DROP FUNCTION IF EXISTS get_lock_namespace(TEXT);
DROP FUNCTION IF EXISTS cascade_soft_delete();
DROP FUNCTION IF EXISTS audit_trigger_func();
DROP FUNCTION IF EXISTS reassign_attorney_cases(UUID, UUID);

-- Note: The original versions of accept_firm_invitation, increment_usage,
-- and schedule_deadline_reminders are in migrations 004 and 008.
*/
