-- Migration: 007_two_factor_auth.sql
-- Description: Two-factor authentication support
-- Created: 2024

-- ============================================================================
-- TABLES
-- ============================================================================

-- Two-factor authentication settings
CREATE TABLE two_factor_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  backup_codes_hash TEXT[] DEFAULT ARRAY[]::TEXT[],
  verified BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Two-factor auth attempts (for rate limiting and auditing)
CREATE TABLE two_factor_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('totp', 'backup_code', 'recovery')),
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recovery codes usage tracking
CREATE TABLE backup_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  two_factor_id UUID NOT NULL REFERENCES two_factor_auth(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_two_factor_auth_user_id ON two_factor_auth(user_id);
CREATE INDEX idx_two_factor_attempts_user_id ON two_factor_attempts(user_id);
CREATE INDEX idx_two_factor_attempts_created_at ON two_factor_attempts(created_at);
CREATE INDEX idx_backup_code_usage_two_factor_id ON backup_code_usage(two_factor_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_code_usage ENABLE ROW LEVEL SECURITY;

-- Two-factor auth: Users can only see their own settings
CREATE POLICY "Users can view own 2FA settings"
  ON two_factor_auth FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own 2FA settings"
  ON two_factor_auth FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own 2FA settings"
  ON two_factor_auth FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own 2FA settings"
  ON two_factor_auth FOR DELETE
  USING (user_id = auth.uid());

-- Admins can view all (for support purposes)
CREATE POLICY "Admins can view all 2FA settings"
  ON two_factor_auth FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Two-factor attempts: Users can see their own attempts
CREATE POLICY "Users can view own 2FA attempts"
  ON two_factor_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert 2FA attempts"
  ON two_factor_attempts FOR INSERT
  WITH CHECK (true);

-- Admins can view all attempts
CREATE POLICY "Admins can view all 2FA attempts"
  ON two_factor_attempts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Backup code usage: Users can see their own usage
CREATE POLICY "Users can view own backup code usage"
  ON backup_code_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM two_factor_auth tfa
      WHERE tfa.id = backup_code_usage.two_factor_id
        AND tfa.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert backup code usage"
  ON backup_code_usage FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_two_factor_auth_updated_at
  BEFORE UPDATE ON two_factor_auth
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if 2FA is enabled for a user
CREATE OR REPLACE FUNCTION is_2fa_enabled(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
  FROM two_factor_auth
  WHERE user_id = p_user_id AND verified = TRUE;

  RETURN COALESCE(v_enabled, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent failed 2FA attempts (for rate limiting)
CREATE OR REPLACE FUNCTION get_recent_2fa_failures(
  p_user_id UUID,
  p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM two_factor_attempts
  WHERE user_id = p_user_id
    AND success = FALSE
    AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if backup code has been used
CREATE OR REPLACE FUNCTION is_backup_code_used(
  p_two_factor_id UUID,
  p_code_hash TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM backup_code_usage
    WHERE two_factor_id = p_two_factor_id
      AND code_hash = p_code_hash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record 2FA attempt
CREATE OR REPLACE FUNCTION record_2fa_attempt(
  p_user_id UUID,
  p_attempt_type TEXT,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO two_factor_attempts (user_id, attempt_type, success, ip_address, user_agent)
  VALUES (p_user_id, p_attempt_type, p_success, p_ip_address, p_user_agent);

  -- Update last_used_at on success
  IF p_success THEN
    UPDATE two_factor_auth
    SET last_used_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark backup code as used
CREATE OR REPLACE FUNCTION mark_backup_code_used(
  p_two_factor_id UUID,
  p_code_hash TEXT,
  p_ip_address INET DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO backup_code_usage (two_factor_id, code_hash, ip_address)
  VALUES (p_two_factor_id, p_code_hash, p_ip_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE PROFILES TABLE
-- ============================================================================

-- Add 2FA requirement flag for enterprise accounts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN DEFAULT FALSE;

-- Update mfa_enabled to reflect actual 2FA status
CREATE OR REPLACE FUNCTION sync_mfa_enabled()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET mfa_enabled = NEW.enabled
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_mfa_enabled_trigger
  AFTER UPDATE OF enabled ON two_factor_auth
  FOR EACH ROW EXECUTE FUNCTION sync_mfa_enabled();
