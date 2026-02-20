-- Migration: Update GDPR anonymization domain from immigrationai.app to casefill.ai
-- This replaces the anonymize_user_data function with the new brand domain
-- Function body matches migration 066 but with @deleted.casefill.ai

CREATE OR REPLACE FUNCTION anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_anon_email TEXT;
BEGIN
  -- Auth check: must be authenticated and match the target user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_anon_email := 'deleted_' || substr(md5(random()::text), 1, 12) || '@deleted.casefill.ai';

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
