-- Bump Free plan limits for early access / beta testers.
-- Gives first lawyers full Pro-level access without needing Stripe.
-- Revert these limits when billing goes live.

UPDATE plan_limits
SET
  max_cases = 100,
  max_documents_per_case = 50,
  max_ai_requests_per_month = 1000,
  max_storage_gb = 25.0,
  max_team_members = 5,
  features = '{"document_analysis": true, "form_autofill": true, "priority_support": false, "api_access": false, "team_collaboration": true, "advanced_reporting": true}'::jsonb,
  updated_at = now()
WHERE plan_type = 'free';
