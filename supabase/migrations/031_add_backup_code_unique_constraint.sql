-- Migration: Add unique constraint to backup_code_usage
-- Purpose: Prevent replay attacks by ensuring backup codes can only be used once
-- Security: CRITICAL - This constraint prevents the same backup code from being reused

-- First, log any duplicates to audit_log for forensic analysis before deletion
-- Duplicates could indicate replay attacks or race conditions
DO $$
DECLARE
  dup_record RECORD;
  severity TEXT;
  context_note TEXT;
BEGIN
  FOR dup_record IN (
    SELECT
      a.id,
      a.two_factor_id,
      a.code_hash,
      a.used_at,
      a.ip_address,
      b.id AS original_id,
      b.used_at AS original_used_at,
      b.ip_address AS original_ip_address
    FROM backup_code_usage a
    INNER JOIN backup_code_usage b ON
      a.two_factor_id = b.two_factor_id
      AND a.code_hash = b.code_hash
      AND a.id > b.id
  ) LOOP
    -- Classify severity based on IP address and timing
    IF dup_record.ip_address IS DISTINCT FROM dup_record.original_ip_address THEN
      severity := 'HIGH';
      context_note := 'Different IP addresses - possible replay attack';
    ELSIF dup_record.used_at - dup_record.original_used_at < INTERVAL '1 minute' THEN
      severity := 'MEDIUM';
      context_note := 'Same IP, quick reuse - possible race condition';
    ELSE
      severity := 'LOW';
      context_note := 'Same IP, slow reuse - likely application bug';
    END IF;

    -- Log to audit_log for forensic analysis
    INSERT INTO audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      changed_by,
      changed_at
    ) VALUES (
      'backup_code_usage',
      dup_record.id,
      'DELETE',
      jsonb_build_object(
        'two_factor_id', dup_record.two_factor_id,
        'code_hash', dup_record.code_hash,
        'used_at', dup_record.used_at,
        'ip_address', dup_record.ip_address,
        'reason', 'duplicate_cleanup_migration',
        'severity', severity,
        'context', context_note,
        'original_record_id', dup_record.original_id,
        'original_used_at', dup_record.original_used_at,
        'original_ip_address', dup_record.original_ip_address
      ),
      NULL,
      NULL,
      NOW()
    );

    RAISE WARNING 'Duplicate backup code usage detected [%]: two_factor_id=%, code_hash=%, severity=%',
      dup_record.id, dup_record.two_factor_id, LEFT(dup_record.code_hash, 8) || '...', severity;
  END LOOP;
END $$;

-- Now remove the duplicates (keeping the original/older record)
DELETE FROM backup_code_usage a
USING backup_code_usage b
WHERE a.id > b.id
  AND a.two_factor_id = b.two_factor_id
  AND a.code_hash = b.code_hash;

-- Add the unique constraint to prevent duplicate backup code usage
-- This ensures each (two_factor_id, code_hash) combination can only exist once
ALTER TABLE backup_code_usage
  ADD CONSTRAINT backup_code_usage_unique UNIQUE (two_factor_id, code_hash);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT backup_code_usage_unique ON backup_code_usage IS
  'Prevents backup code replay attacks by ensuring each code can only be used once per user';
