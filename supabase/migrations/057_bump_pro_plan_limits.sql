-- Bump Pro plan limits to maintain Free < Pro < Enterprise hierarchy.
-- Free was bumped in migration 056 for early access (100 cases, 1000 AI).
-- Pro must exceed Free limits so paying users never get less.

UPDATE plan_limits
SET
  max_cases = 250,
  max_documents_per_case = 100,
  max_ai_requests_per_month = 2500,
  max_storage_gb = 50.0,
  max_team_members = 10,
  updated_at = now()
WHERE plan_type = 'pro';
