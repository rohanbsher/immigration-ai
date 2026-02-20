-- Backfill firm_id on cases from the attorney's profile to tighten multi-tenant isolation.
-- checkFirmIdMatch() in api-helpers.ts soft-allows null firm_id with a warning log;
-- this backfill populates what it can so the strict path is taken for most cases.
UPDATE cases c
SET firm_id = p.primary_firm_id
FROM profiles p
WHERE c.attorney_id = p.id
  AND c.firm_id IS NULL
  AND p.primary_firm_id IS NOT NULL;
