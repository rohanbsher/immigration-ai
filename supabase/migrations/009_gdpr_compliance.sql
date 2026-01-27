-- Migration: 009_gdpr_compliance.sql
-- Description: GDPR compliance features for data export, deletion, and consent
-- Created: 2024

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE consent_type AS ENUM (
  'terms_of_service',
  'privacy_policy',
  'data_processing',
  'marketing_communications',
  'analytics_tracking'
);

CREATE TYPE export_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'expired'
);

CREATE TYPE deletion_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'cancelled'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- User consent tracking
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type consent_type NOT NULL,
  version TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, consent_type)
);

-- GDPR data export jobs
CREATE TABLE gdpr_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status export_status NOT NULL DEFAULT 'pending',
  file_path TEXT,
  file_size_bytes BIGINT,
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GDPR deletion requests
CREATE TABLE gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  status deletion_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data retention policy log
CREATE TABLE data_retention_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('anonymize', 'delete', 'archive')),
  reason TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX idx_gdpr_export_jobs_user_id ON gdpr_export_jobs(user_id);
CREATE INDEX idx_gdpr_export_jobs_status ON gdpr_export_jobs(status);
CREATE INDEX idx_gdpr_deletion_requests_user_id ON gdpr_deletion_requests(user_id);
CREATE INDEX idx_gdpr_deletion_requests_status ON gdpr_deletion_requests(status);
CREATE INDEX idx_gdpr_deletion_requests_scheduled_for ON gdpr_deletion_requests(scheduled_for);
CREATE INDEX idx_data_retention_log_table_name ON data_retention_log(table_name);
CREATE INDEX idx_data_retention_log_executed_at ON data_retention_log(executed_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_log ENABLE ROW LEVEL SECURITY;

-- User consents
CREATE POLICY "Users can view own consents"
  ON user_consents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own consents"
  ON user_consents FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all consents"
  ON user_consents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Export jobs
CREATE POLICY "Users can view own export jobs"
  ON gdpr_export_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own export jobs"
  ON gdpr_export_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update export jobs"
  ON gdpr_export_jobs FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all export jobs"
  ON gdpr_export_jobs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Deletion requests
CREATE POLICY "Users can view own deletion requests"
  ON gdpr_deletion_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own deletion requests"
  ON gdpr_deletion_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own deletion requests"
  ON gdpr_deletion_requests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all deletion requests"
  ON gdpr_deletion_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Data retention log (admins only)
CREATE POLICY "Admins can view data retention log"
  ON data_retention_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert data retention log"
  ON data_retention_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_user_consents_updated_at
  BEFORE UPDATE ON user_consents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gdpr_export_jobs_updated_at
  BEFORE UPDATE ON gdpr_export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gdpr_deletion_requests_updated_at
  BEFORE UPDATE ON gdpr_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to record user consent
CREATE OR REPLACE FUNCTION record_user_consent(
  p_user_id UUID,
  p_consent_type consent_type,
  p_version TEXT,
  p_granted BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS user_consents AS $$
DECLARE
  v_result user_consents%ROWTYPE;
BEGIN
  INSERT INTO user_consents (
    user_id,
    consent_type,
    version,
    granted,
    granted_at,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_consent_type,
    p_version,
    p_granted,
    CASE WHEN p_granted THEN NOW() ELSE NULL END,
    p_ip_address,
    p_user_agent
  )
  ON CONFLICT (user_id, consent_type)
  DO UPDATE SET
    version = EXCLUDED.version,
    granted = EXCLUDED.granted,
    granted_at = CASE WHEN EXCLUDED.granted THEN NOW() ELSE user_consents.granted_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.granted AND user_consents.granted THEN NOW() ELSE NULL END,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create data export job
CREATE OR REPLACE FUNCTION create_gdpr_export_job(p_user_id UUID)
RETURNS gdpr_export_jobs AS $$
DECLARE
  v_existing gdpr_export_jobs%ROWTYPE;
  v_result gdpr_export_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM gdpr_export_jobs
  WHERE user_id = p_user_id
    AND status IN ('pending', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'An export job is already in progress';
  END IF;

  INSERT INTO gdpr_export_jobs (user_id)
  VALUES (p_user_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request account deletion
CREATE OR REPLACE FUNCTION request_account_deletion(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_grace_period_days INTEGER DEFAULT 30
)
RETURNS gdpr_deletion_requests AS $$
DECLARE
  v_existing gdpr_deletion_requests%ROWTYPE;
  v_result gdpr_deletion_requests%ROWTYPE;
  v_user profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_existing
  FROM gdpr_deletion_requests
  WHERE user_id = p_user_id
    AND status = 'pending';

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'A deletion request is already pending';
  END IF;

  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO gdpr_deletion_requests (
    user_id,
    user_email,
    reason,
    scheduled_for
  ) VALUES (
    p_user_id,
    v_user.email,
    p_reason,
    NOW() + (p_grace_period_days || ' days')::INTERVAL
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel deletion request
CREATE OR REPLACE FUNCTION cancel_deletion_request(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE gdpr_deletion_requests
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason
  WHERE user_id = p_user_id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to anonymize user data (for soft delete)
CREATE OR REPLACE FUNCTION anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_anon_email TEXT;
BEGIN
  v_anon_email := 'deleted_' || substr(md5(random()::text), 1, 12) || '@deleted.immigrationai.app';

  UPDATE profiles
  SET
    email = v_anon_email,
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    avatar_url = NULL,
    date_of_birth = NULL,
    country_of_birth = NULL,
    nationality = NULL,
    alien_number = NULL,
    bar_number = NULL,
    firm_name = NULL,
    specializations = NULL
  WHERE id = p_user_id;

  INSERT INTO data_retention_log (table_name, record_id, action, reason)
  VALUES ('profiles', p_user_id, 'anonymize', 'GDPR deletion request');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user data for export
CREATE OR REPLACE FUNCTION get_user_export_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
  v_cases JSONB;
  v_documents JSONB;
  v_forms JSONB;
  v_activities JSONB;
  v_consents JSONB;
BEGIN
  SELECT to_jsonb(p) - 'id' INTO v_profile
  FROM profiles p
  WHERE id = p_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) - 'id' - 'attorney_id' - 'client_id'), '[]'::jsonb)
  INTO v_cases
  FROM cases c
  WHERE (c.attorney_id = p_user_id OR c.client_id = p_user_id)
    AND c.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', d.document_type,
      'status', d.status,
      'fileName', d.file_name,
      'fileSize', d.file_size,
      'mimeType', d.mime_type,
      'createdAt', d.created_at
    )
  ), '[]'::jsonb)
  INTO v_documents
  FROM documents d
  WHERE d.uploaded_by = p_user_id
    AND d.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'formType', f.form_type,
      'status', f.status,
      'createdAt', f.created_at
    )
  ), '[]'::jsonb)
  INTO v_forms
  FROM forms f
  JOIN cases c ON c.id = f.case_id
  WHERE (c.attorney_id = p_user_id OR c.client_id = p_user_id)
    AND f.deleted_at IS NULL;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'activityType', a.activity_type,
      'description', a.description,
      'createdAt', a.created_at
    )
  ), '[]'::jsonb)
  INTO v_activities
  FROM activities a
  WHERE a.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', uc.consent_type,
      'version', uc.version,
      'granted', uc.granted,
      'grantedAt', uc.granted_at
    )
  ), '[]'::jsonb)
  INTO v_consents
  FROM user_consents uc
  WHERE uc.user_id = p_user_id;

  RETURN jsonb_build_object(
    'exportDate', NOW(),
    'profile', v_profile,
    'cases', v_cases,
    'documents', v_documents,
    'forms', v_forms,
    'activities', v_activities,
    'consents', v_consents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
