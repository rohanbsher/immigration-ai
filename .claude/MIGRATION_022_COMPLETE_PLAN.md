# Migration 022: Complete Architectural Plan

## Executive Summary

**Status**: Migration 022 is NOT deployed to production (verified via `supabase migration list`)

**Problem**: The current migration is only 30% complete - it handles soft-delete cascade for 3 tables but cases have 10+ child tables.

**Solution**: Rewrite migration 022 to be architecturally complete before deployment.

---

## The Root Problem

When a case is soft-deleted (`deleted_at = NOW()`), we need to handle 10+ child tables correctly. Currently:

| Table | Has deleted_at? | In Trigger? | FK = RESTRICT? | Gap |
|-------|-----------------|-------------|----------------|-----|
| documents | ✅ | ✅ | ✅ | None |
| forms | ✅ | ✅ | ✅ | None |
| tasks | ✅ | ✅ | ✅ | None |
| **case_messages** | ✅ | ❌ | ✅ | Missing from trigger |
| **document_requests** | ✅ | ❌ | ✅ | Missing from trigger |
| **task_comments** | ✅ | ❌ | N/A | Missing from trigger (via tasks) |
| **activities** | ❌ | ❌ | ✅ | No deleted_at - intentional (audit) |
| **case_assignments** | ❌ | ❌ | ✅ | No deleted_at - intentional (history) |
| **deadline_alerts** | ❌ | ❌ | ✅ | Should hard-delete (transient) |
| **scheduled_emails** | ❌ | ❌ | ❌ CASCADE | Should hard-delete + fix FK |
| **conversations** | ❌ | ❌ | ❌ SET NULL | Should unlink (SET NULL is correct) |

---

## Architectural Decision: Table Classification

Based on legal/compliance requirements for immigration law:

### Category A: AUDIT-CRITICAL (Soft-delete cascade)
These must be preserved but hidden when case is soft-deleted:

- `documents` - Evidence of filings
- `forms` - Proof of what was submitted
- `case_messages` - Attorney-client privilege
- `document_requests` - Proof of diligence
- `tasks` + `task_comments` - Work product history

**Action**: Cascade `deleted_at` from parent case

### Category B: IMMUTABLE AUDIT TRAIL (No delete)
These are the audit log - they should NEVER be deleted or hidden:

- `activities` - Complete audit trail of all actions
- `case_assignments` - Historical record of who worked on case

**Action**: Keep visible even when case is soft-deleted. RLS policies should allow viewing for compliance queries.

### Category C: TRANSIENT (Hard-delete on case soft-delete)
These have no legal value after case closure:

- `scheduled_emails` - Pending reminders (useless after closure)
- `deadline_alerts` - Upcoming deadline warnings (useless after closure)

**Action**: Hard DELETE when case is soft-deleted

### Category D: UNLINK (SET NULL)
These are user-owned, not case-owned:

- `conversations` - User may want to keep AI chat history

**Action**: SET case_id = NULL (already correct FK behavior)

---

## The Complete Solution

### Part 1: Fix the Soft Delete Trigger

```sql
CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
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

      -- Category C: Hard-delete transient data
      DELETE FROM scheduled_emails WHERE case_id = NEW.id;
      DELETE FROM deadline_alerts WHERE case_id = NEW.id;

      -- Category D: Conversations already have SET NULL FK - no action needed

    -- RESTORE: Case is being restored
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
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
      -- Note: Hard-deleted data (scheduled_emails, deadline_alerts) cannot be restored
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
```

### Part 2: Fix FK Constraints

```sql
-- scheduled_emails: Change from CASCADE to RESTRICT
-- (Our trigger handles deletion, FK should block accidental hard-deletes)
ALTER TABLE scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_case_id_fkey;
ALTER TABLE scheduled_emails ADD CONSTRAINT scheduled_emails_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT;

-- conversations: Keep SET NULL (correct behavior)
-- No change needed - already correct
```

### Part 3: Handle Function Dependencies

The `schedule_deadline_reminders()` function calls `get_upcoming_deadline_cases()` from migration 008. We have two options:

**Option A**: Add a guard clause (defensive)
```sql
CREATE OR REPLACE FUNCTION schedule_deadline_reminders(...)
RETURNS TABLE (...) AS $$
BEGIN
  -- Guard: Check if dependency exists
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_upcoming_deadline_cases') THEN
    RAISE WARNING 'get_upcoming_deadline_cases() not found - skipping';
    RETURN;
  END IF;

  -- ... rest of function
END;
```

**Option B**: Document the dependency (cleaner)
```sql
-- DEPENDENCY: Requires migration 008 to be applied first
-- This function calls get_upcoming_deadline_cases() from 008_notification_preferences.sql
```

**Recommendation**: Option B - migrations run in order, and documenting is cleaner than runtime guards.

### Part 4: Remove Lock Namespace ELSE 0

```sql
CREATE OR REPLACE FUNCTION get_lock_namespace(p_operation TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_operation
    WHEN 'firm_invitation' THEN 1
    WHEN 'usage_update' THEN 2
    WHEN 'case_delete' THEN 3
    ELSE
      RAISE EXCEPTION 'Unknown lock namespace: %', p_operation
        USING ERRCODE = 'P0001';
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Part 5: Add Authorization to reassign_attorney_cases

```sql
CREATE OR REPLACE FUNCTION reassign_attorney_cases(
  p_old_attorney_id UUID,
  p_new_attorney_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_caller UUID := auth.uid();
BEGIN
  -- Authorization check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT is_system_admin(v_caller) AND v_caller != p_old_attorney_id THEN
    RAISE EXCEPTION 'Only admins or the attorney themselves can reassign cases'
      USING ERRCODE = '42501';
  END IF;

  UPDATE cases
  SET attorney_id = p_new_attorney_id, updated_at = NOW()
  WHERE attorney_id = p_old_attorney_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
```

---

## What NOT to Change

### Activities Table
- **No deleted_at column** - This is intentional
- Activities are the immutable audit log
- They should remain visible even when case is soft-deleted
- RLS policies already handle access control

### Case Assignments Table
- **No deleted_at column** - This is intentional
- Historical record of who worked on what case
- Should remain visible for compliance queries

### Conversations Table
- **FK is SET NULL** - This is correct
- When case is soft-deleted, conversations remain but case_id becomes NULL
- User keeps their AI chat history

---

## Migration File Changes Summary

| Section | Current State | Required Change |
|---------|--------------|-----------------|
| Soft delete trigger | 3 tables | Add case_messages, document_requests, hard-delete transient |
| scheduled_emails FK | Missing | Add RESTRICT constraint |
| get_lock_namespace | Returns 0 for unknown | Throw exception |
| reassign_attorney_cases | No auth check | Add is_system_admin check |
| Function dependencies | Implicit | Add explicit comments |

---

## Implementation Order

1. **Read current 022 file** - Understand current state
2. **Update cascade_soft_delete()** - Add missing tables
3. **Add scheduled_emails FK** - In PART 8b
4. **Fix get_lock_namespace()** - Throw instead of return 0
5. **Fix reassign_attorney_cases()** - Add auth check
6. **Add dependency comments** - Document 008, 011, 021 deps
7. **Update rollback section** - Include new FK
8. **Test locally** - Verify trigger works
9. **Deploy** - `supabase db push`

---

## Verification Checklist

After implementation, verify:

- [ ] Soft-deleting a case cascades to documents, forms, tasks, case_messages, document_requests
- [ ] Soft-deleting a case hard-deletes scheduled_emails and deadline_alerts
- [ ] Soft-deleting a case leaves activities and case_assignments visible
- [ ] Soft-deleting a case sets conversations.case_id to NULL
- [ ] Restoring a case restores documents, forms, tasks, case_messages, document_requests
- [ ] Hard-delete of a case is blocked by FK RESTRICT
- [ ] Unknown lock namespace throws exception
- [ ] Non-admin cannot call reassign_attorney_cases for other attorneys

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Trigger fails mid-cascade | Low | High | Wrap in exception handler, log errors |
| FK order prevents hard-delete of deadline_alerts | Low | Medium | Hard-delete happens BEFORE FK is checked |
| Activities queries break after case soft-delete | Medium | Low | Update RLS to allow viewing for audit |
| Performance on large cases | Medium | Medium | Batch updates if >1000 children |

---

## Conclusion

Migration 022 needs to be **rewritten as a complete architectural solution**, not patched. The changes are:

1. Complete soft-delete cascade (5 tables, not 3)
2. Hard-delete transient data (scheduled_emails, deadline_alerts)
3. Fix scheduled_emails FK (RESTRICT, not CASCADE)
4. Add security (auth check on reassign_attorney_cases)
5. Add safety (throw on unknown lock namespace)

Since 022 is not deployed, we can make these changes directly without a new migration.
