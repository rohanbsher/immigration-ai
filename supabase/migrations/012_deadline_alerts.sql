-- Deadline Alerts System
-- Creates tables for tracking and notifying users about upcoming deadlines

-- Deadline alerts table
CREATE TABLE deadline_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('case_deadline', 'document_expiry', 'processing_estimate')),
  deadline_date DATE NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate alerts for the same case/type/date
  UNIQUE(case_id, alert_type, deadline_date)
);

-- Indexes for performance
CREATE INDEX idx_deadline_alerts_user ON deadline_alerts(user_id);
CREATE INDEX idx_deadline_alerts_user_unack ON deadline_alerts(user_id) WHERE NOT acknowledged;
CREATE INDEX idx_deadline_alerts_case ON deadline_alerts(case_id);
CREATE INDEX idx_deadline_alerts_severity ON deadline_alerts(severity);
CREATE INDEX idx_deadline_alerts_date ON deadline_alerts(deadline_date);

-- Enable RLS
ALTER TABLE deadline_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own alerts"
  ON deadline_alerts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own alerts"
  ON deadline_alerts FOR UPDATE
  USING (user_id = auth.uid());

-- System can insert alerts (for cron job)
CREATE POLICY "System can insert alerts"
  ON deadline_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can delete alerts"
  ON deadline_alerts FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_deadline_alerts_updated_at
  BEFORE UPDATE ON deadline_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Processing times reference table (for future ML/estimates)
CREATE TABLE processing_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL,
  service_center TEXT,
  receipt_date DATE,
  min_days INTEGER NOT NULL,
  max_days INTEGER NOT NULL,
  median_days INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_type, service_center, receipt_date)
);

-- Insert default processing times (approximate USCIS estimates)
INSERT INTO processing_times (form_type, min_days, max_days, median_days) VALUES
  ('I-130', 365, 730, 547),    -- 12-24 months
  ('I-485', 240, 730, 485),    -- 8-24 months
  ('I-765', 90, 180, 135),     -- 3-6 months
  ('I-131', 90, 180, 135),     -- 3-6 months
  ('I-140', 180, 365, 272),    -- 6-12 months
  ('I-129', 30, 180, 105),     -- 1-6 months
  ('I-539', 120, 365, 242),    -- 4-12 months
  ('N-400', 365, 730, 547),    -- 12-24 months
  ('DS-160', 30, 90, 60);      -- 1-3 months
