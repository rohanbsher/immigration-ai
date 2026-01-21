-- Migration: 008_notification_preferences.sql
-- Description: Email notification preferences and delivery tracking
-- Created: 2024

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'push');
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'failed');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Notification preferences per user
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  email_case_updates BOOLEAN DEFAULT TRUE,
  email_deadline_reminders BOOLEAN DEFAULT TRUE,
  email_document_uploads BOOLEAN DEFAULT TRUE,
  email_form_updates BOOLEAN DEFAULT TRUE,
  email_team_updates BOOLEAN DEFAULT TRUE,
  email_billing_updates BOOLEAN DEFAULT TRUE,
  email_marketing BOOLEAN DEFAULT FALSE,
  deadline_reminder_days INTEGER[] DEFAULT ARRAY[7, 3, 1],
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email delivery log for tracking and debugging
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  email_from TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_name TEXT,
  template_data JSONB DEFAULT '{}',
  status email_status NOT NULL DEFAULT 'pending',
  resend_id TEXT,
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled emails (for deadline reminders, etc.)
CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  email_log_id UUID REFERENCES email_log(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_email_log_user_id ON email_log(user_id);
CREATE INDEX idx_email_log_status ON email_log(status);
CREATE INDEX idx_email_log_created_at ON email_log(created_at);
CREATE INDEX idx_email_log_resend_id ON email_log(resend_id);
CREATE INDEX idx_scheduled_emails_user_id ON scheduled_emails(user_id);
CREATE INDEX idx_scheduled_emails_scheduled_for ON scheduled_emails(scheduled_for);
CREATE INDEX idx_scheduled_emails_sent ON scheduled_emails(sent);
CREATE INDEX idx_scheduled_emails_case_id ON scheduled_emails(case_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Notification preferences: Users can only see their own
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all notification preferences"
  ON notification_preferences FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Email log: Users can see their own emails, admins see all
CREATE POLICY "Users can view own email log"
  ON email_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all email logs"
  ON email_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert email logs"
  ON email_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update email logs"
  ON email_log FOR UPDATE
  USING (true);

-- Scheduled emails: Users can see their own
CREATE POLICY "Users can view own scheduled emails"
  ON scheduled_emails FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all scheduled emails"
  ON scheduled_emails FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can manage scheduled emails"
  ON scheduled_emails FOR ALL
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_log_updated_at
  BEFORE UPDATE ON email_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get or create notification preferences
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
BEGIN
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF v_prefs IS NULL THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;

  RETURN v_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user wants to receive specific email type
CREATE OR REPLACE FUNCTION should_send_email(
  p_user_id UUID,
  p_email_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
  v_should_send BOOLEAN;
BEGIN
  v_prefs := get_or_create_notification_preferences(p_user_id);

  IF NOT v_prefs.email_enabled THEN
    RETURN FALSE;
  END IF;

  CASE p_email_type
    WHEN 'case_update' THEN v_should_send := v_prefs.email_case_updates;
    WHEN 'deadline_reminder' THEN v_should_send := v_prefs.email_deadline_reminders;
    WHEN 'document_upload' THEN v_should_send := v_prefs.email_document_uploads;
    WHEN 'form_update' THEN v_should_send := v_prefs.email_form_updates;
    WHEN 'team_update' THEN v_should_send := v_prefs.email_team_updates;
    WHEN 'billing_update' THEN v_should_send := v_prefs.email_billing_updates;
    WHEN 'marketing' THEN v_should_send := v_prefs.email_marketing;
    ELSE v_should_send := TRUE;
  END CASE;

  RETURN v_should_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get upcoming deadlines for reminders
CREATE OR REPLACE FUNCTION get_upcoming_deadline_cases(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  case_id UUID,
  user_id UUID,
  case_title TEXT,
  deadline DATE,
  days_until INTEGER,
  user_email TEXT,
  user_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as case_id,
    c.attorney_id as user_id,
    c.title as case_title,
    c.deadline,
    (c.deadline - CURRENT_DATE)::INTEGER as days_until,
    p.email as user_email,
    COALESCE(p.first_name || ' ' || p.last_name, p.email) as user_name
  FROM cases c
  JOIN profiles p ON p.id = c.attorney_id
  JOIN notification_preferences np ON np.user_id = c.attorney_id
  WHERE c.deadline IS NOT NULL
    AND c.deadline >= CURRENT_DATE
    AND c.deadline <= CURRENT_DATE + p_days
    AND c.deleted_at IS NULL
    AND c.status NOT IN ('completed', 'closed')
    AND np.email_enabled = TRUE
    AND np.email_deadline_reminders = TRUE
    AND (c.deadline - CURRENT_DATE)::INTEGER = ANY(np.deadline_reminder_days)
  ORDER BY c.deadline ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to schedule deadline reminder emails
CREATE OR REPLACE FUNCTION schedule_deadline_reminders()
RETURNS INTEGER AS $$
DECLARE
  v_case RECORD;
  v_scheduled INTEGER := 0;
BEGIN
  FOR v_case IN
    SELECT * FROM get_upcoming_deadline_cases(7)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM scheduled_emails
      WHERE case_id = v_case.case_id
        AND email_type = 'deadline_reminder'
        AND DATE(scheduled_for) = CURRENT_DATE
    ) THEN
      INSERT INTO scheduled_emails (
        user_id,
        case_id,
        email_type,
        scheduled_for,
        metadata
      ) VALUES (
        v_case.user_id,
        v_case.case_id,
        'deadline_reminder',
        NOW(),
        jsonb_build_object(
          'days_until', v_case.days_until,
          'deadline', v_case.deadline,
          'case_title', v_case.case_title
        )
      );
      v_scheduled := v_scheduled + 1;
    END IF;
  END LOOP;

  RETURN v_scheduled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
