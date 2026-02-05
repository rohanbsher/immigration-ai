-- Migration: Atomic message update using JSONB merge operator
-- Fixes race condition in updateMessage() where concurrent updates could overwrite metadata

CREATE OR REPLACE FUNCTION update_message_with_metadata(
  p_message_id UUID,
  p_content TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result RECORD;
BEGIN
  UPDATE conversation_messages
  SET
    content = COALESCE(p_content, content),
    metadata = CASE
      WHEN p_status IS NOT NULL
      THEN COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('status', p_status)
      ELSE metadata
    END
  WHERE id = p_message_id
  RETURNING id, content, metadata INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;

  RETURN json_build_object(
    'id', v_result.id,
    'content', v_result.content,
    'metadata', v_result.metadata
  );
END;
$$;

COMMENT ON FUNCTION update_message_with_metadata IS
  'Atomic message update with JSONB merge. Prevents race conditions in concurrent updates.';
