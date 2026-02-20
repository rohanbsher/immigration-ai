-- Migration: 064_rfe_assessments.sql
-- Description: Add RFE assessment tracking table and cache columns on cases
--
-- The RFE Prevention Engine stores historical assessments and caches the
-- latest result on the cases table for fast reads.

-- RFE Assessment tracking table
CREATE TABLE public.rfe_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE RESTRICT,
  visa_type TEXT NOT NULL,
  rfe_risk_score INTEGER NOT NULL CHECK (rfe_risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  estimated_rfe_probability NUMERIC(4,3) NOT NULL CHECK (estimated_rfe_probability BETWEEN 0 AND 1),
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  safe_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_confidence NUMERIC(4,3) NOT NULL CHECK (data_confidence BETWEEN 0 AND 1),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'document_uploaded', 'form_filled', 'manual', 'case_created', 'status_changed'
  )),
  assessment_version TEXT NOT NULL DEFAULT '1.0',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rfe_assessments_case_id ON public.rfe_assessments(case_id);
CREATE INDEX idx_rfe_assessments_risk_level ON public.rfe_assessments(risk_level);
CREATE INDEX idx_rfe_assessments_latest ON public.rfe_assessments(case_id, assessed_at DESC);

-- RLS
ALTER TABLE public.rfe_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RFE assessments for their cases"
  ON public.rfe_assessments FOR SELECT
  USING (can_access_case(auth.uid(), case_id));

CREATE POLICY "Service role can manage RFE assessments"
  ON public.rfe_assessments FOR ALL
  USING (auth.role() = 'service_role');

-- Cache columns on cases table (mirrors pattern from migration 055)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS rfe_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS rfe_risk_level TEXT CHECK (rfe_risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS rfe_assessment JSONB,
  ADD COLUMN IF NOT EXISTS rfe_assessed_at TIMESTAMPTZ;

-- Index for dashboard queries filtering by risk level
CREATE INDEX idx_cases_rfe_risk_level
  ON public.cases(rfe_risk_level)
  WHERE deleted_at IS NULL AND rfe_risk_level IS NOT NULL;

COMMENT ON TABLE public.rfe_assessments IS 'Historical RFE risk assessments per case. Latest cached on cases table.';
COMMENT ON COLUMN public.cases.rfe_risk_score IS 'Cached RFE risk score (0-100, 100=no risk). Updated by assessment engine.';
COMMENT ON COLUMN public.cases.rfe_risk_level IS 'Cached risk level: low/medium/high/critical.';
