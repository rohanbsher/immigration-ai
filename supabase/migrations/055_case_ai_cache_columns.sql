-- Migration: Add AI cache columns to cases table
-- These columns store cached results from worker processors,
-- allowing API routes to serve fresh results without re-enqueueing jobs.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_recommendations JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_completeness JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_success_score JSONB;

COMMENT ON COLUMN cases.ai_recommendations IS 'Cached AI recommendations from worker';
COMMENT ON COLUMN cases.ai_completeness IS 'Cached document completeness analysis from worker';
COMMENT ON COLUMN cases.ai_success_score IS 'Cached success probability score from worker';
