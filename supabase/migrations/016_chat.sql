-- Feature 6: AI Chat Assistant Database Schema
-- Created: 2026-01-27
-- Description: Tables for storing chat conversations and messages

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation messages table
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_case ON conversations(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON conversation_messages(conversation_id, created_at);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their conversations"
  ON conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their conversations"
  ON conversations FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for conversation messages
CREATE POLICY "Users can view their messages"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their messages"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their messages"
  ON conversation_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Function to update conversation timestamp on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Grant permissions
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversation_messages TO authenticated;
