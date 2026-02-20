-- Migration: 063_expand_gdpr_export.sql
-- Description: Expand GDPR data export to include AI conversations and case messages
-- Created: 2026-02-20

-- Replace the get_user_export_data function with an expanded version
-- that includes AI conversations and case messages (GDPR Article 20)
CREATE OR REPLACE FUNCTION get_user_export_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
  v_cases JSONB;
  v_documents JSONB;
  v_forms JSONB;
  v_activities JSONB;
  v_consents JSONB;
  v_conversations JSONB;
  v_case_messages JSONB;
BEGIN
  -- Profile data
  SELECT to_jsonb(p) - 'id' INTO v_profile
  FROM profiles p
  WHERE id = p_user_id;

  -- Cases
  SELECT COALESCE(jsonb_agg(to_jsonb(c) - 'id' - 'attorney_id' - 'client_id'), '[]'::jsonb)
  INTO v_cases
  FROM cases c
  WHERE (c.attorney_id = p_user_id OR c.client_id = p_user_id)
    AND c.deleted_at IS NULL;

  -- Documents (metadata only — file contents not included for size)
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

  -- Forms (includes form_data for data portability)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'formType', f.form_type,
      'status', f.status,
      'formData', f.form_data,
      'createdAt', f.created_at,
      'updatedAt', f.updated_at
    )
  ), '[]'::jsonb)
  INTO v_forms
  FROM forms f
  JOIN cases c ON c.id = f.case_id
  WHERE (c.attorney_id = p_user_id OR c.client_id = p_user_id)
    AND f.deleted_at IS NULL;

  -- Activities
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

  -- Consents
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

  -- AI Conversations (with messages)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'title', conv.title,
      'createdAt', conv.created_at,
      'messages', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'role', cm.role,
            'content', cm.content,
            'createdAt', cm.created_at
          ) ORDER BY cm.created_at
        ), '[]'::jsonb)
        FROM conversation_messages cm
        WHERE cm.conversation_id = conv.id
      )
    ) ORDER BY conv.created_at
  ), '[]'::jsonb)
  INTO v_conversations
  FROM conversations conv
  WHERE conv.user_id = p_user_id
    AND conv.deleted_at IS NULL;

  -- Case Messages (attorney-client communication)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'caseTitle', c.title,
      'content', msg.content,
      'sentByUser', msg.sender_id = p_user_id,
      'createdAt', msg.created_at
    ) ORDER BY msg.created_at
  ), '[]'::jsonb)
  INTO v_case_messages
  FROM case_messages msg
  JOIN cases c ON c.id = msg.case_id
  WHERE msg.sender_id = p_user_id
    AND msg.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'exportDate', NOW(),
    'profile', v_profile,
    'cases', v_cases,
    'documents', v_documents,
    'forms', v_forms,
    'activities', v_activities,
    'consents', v_consents,
    'aiConversations', v_conversations,
    'caseMessages', v_case_messages
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
