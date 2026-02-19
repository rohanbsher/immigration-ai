-- Add 'waiting' to the job_status CHECK constraint.
-- BullMQ reports state as 'waiting'; our API returns 'queued'.
-- Both are valid states that should be accepted.

ALTER TABLE job_status DROP CONSTRAINT IF EXISTS job_status_status_check;

ALTER TABLE job_status ADD CONSTRAINT job_status_status_check
  CHECK (status IN ('queued', 'waiting', 'active', 'completed', 'failed', 'delayed'));
