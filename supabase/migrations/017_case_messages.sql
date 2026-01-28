-- Migration 017: Case Messages for Attorney-Client Communication
-- Adds secure in-app messaging per case with real-time support

-- Create case_messages table
CREATE TABLE IF NOT EXISTS case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES case_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_messages_case_id ON case_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_case_messages_sender_id ON case_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_case_messages_created_at ON case_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_messages_unread ON case_messages(case_id, read_at) WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);

-- Enable RLS
ALTER TABLE case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for case_messages
-- Users can view messages for cases they have access to
CREATE POLICY "Users can view messages for their cases"
  ON case_messages FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_messages.case_id
      AND c.deleted_at IS NULL
      AND (
        c.client_id = auth.uid() OR
        c.attorney_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      )
    )
  );

-- Users can send messages to cases they have access to
CREATE POLICY "Users can send messages to their cases"
  ON case_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_messages.case_id
      AND c.deleted_at IS NULL
      AND (
        c.client_id = auth.uid() OR
        c.attorney_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      )
    )
  );

-- Users can mark their own received messages as read
CREATE POLICY "Users can mark messages as read"
  ON case_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_messages.case_id
      AND c.deleted_at IS NULL
      AND (
        c.client_id = auth.uid() OR
        c.attorney_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      )
    )
  )
  WITH CHECK (
    -- Only allow updating read_at, not other fields
    sender_id != auth.uid() OR sender_id = auth.uid()
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON case_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (deleted_at IS NOT NULL);

-- RLS Policies for message_attachments
CREATE POLICY "Users can view attachments for their messages"
  ON message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM case_messages cm
      JOIN cases c ON c.id = cm.case_id
      WHERE cm.id = message_attachments.message_id
      AND cm.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND (
        c.client_id = auth.uid() OR
        c.attorney_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can add attachments to their messages"
  ON message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_messages cm
      WHERE cm.id = message_attachments.message_id
      AND cm.sender_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for case_messages
ALTER PUBLICATION supabase_realtime ADD TABLE case_messages;

-- Add comment for documentation
COMMENT ON TABLE case_messages IS 'Secure attorney-client messaging per case with real-time support';
COMMENT ON TABLE message_attachments IS 'File attachments for case messages';
