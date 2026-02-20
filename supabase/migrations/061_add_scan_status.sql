-- Add scan_status column to documents table for security scan tracking
-- TypeScript code references this column but it was never created in the DB,
-- making the security blocking logic (scan_status === 'degraded') a no-op.
ALTER TABLE documents ADD COLUMN scan_status TEXT DEFAULT 'clean'
  CHECK (scan_status IN ('clean', 'degraded', 'pending', 'infected'));

-- Backfill existing documents as 'clean' (they passed validation at upload time)
UPDATE documents SET scan_status = 'clean' WHERE scan_status IS NULL;
