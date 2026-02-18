-- Job status tracking for BullMQ background jobs.
-- Allows the frontend to poll job progress via Supabase or the /api/jobs/[id]/status route.

CREATE TABLE job_status (
  id TEXT PRIMARY KEY,                        -- BullMQ job ID
  queue_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,                            -- 'document', 'form', 'case'
  entity_id UUID,                              -- Reference to the entity being processed
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'active', 'completed', 'failed', 'delayed')),
  progress INTEGER DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- RLS: users can only see their own jobs
ALTER TABLE job_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON job_status FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (worker) can insert/update any row (bypasses RLS)

-- Index for frontend polling: find active jobs for a user
CREATE INDEX idx_job_status_user_active
  ON job_status (user_id, status)
  WHERE status IN ('queued', 'active');

-- Index for cleanup: find old completed/failed jobs
CREATE INDEX idx_job_status_completed_at
  ON job_status (completed_at)
  WHERE status IN ('completed', 'failed');

-- Index for entity lookup: find jobs for a specific document/form/case
CREATE INDEX idx_job_status_entity
  ON job_status (entity_type, entity_id)
  WHERE entity_type IS NOT NULL;
