'use server';

import { createClient } from '@/lib/supabase/server';
import { generateConversationTitle } from '@/lib/ai/chat';

/**
 * Conversation interface.
 */
export interface Conversation {
  id: string;
  userId: string;
  caseId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Message status for tracking streaming state.
 */
export type MessageStatus = 'streaming' | 'complete' | 'error';

/**
 * Conversation message interface.
 */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  status?: MessageStatus;
  createdAt: string;
}

/**
 * Create a new conversation.
 */
export async function createConversation(
  userId: string,
  caseId?: string,
  title?: string
): Promise<Conversation> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      case_id: caseId || null,
      title: title || 'New Conversation',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    caseId: data.case_id || undefined,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get a conversation by ID.
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select()
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    caseId: data.case_id || undefined,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get all conversations for a user.
 */
export async function getConversations(
  userId: string,
  options?: {
    caseId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Conversation[]> {
  const supabase = await createClient();

  let query = supabase
    .from('conversations')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (options?.caseId) {
    query = query.eq('case_id', options.caseId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get conversations: ${error.message}`);
  }

  return (data || []).map(conv => ({
    id: conv.id,
    userId: conv.user_id,
    caseId: conv.case_id || undefined,
    title: conv.title,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  }));
}

/**
 * Update conversation title.
 */
export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update conversation: ${error.message}`);
  }
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
}

/**
 * Get messages for a conversation.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<ConversationMessage[]> {
  const supabase = await createClient();

  // Verify conversation access
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const { data, error } = await supabase
    .from('conversation_messages')
    .select()
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return (data || []).map(msg => ({
    id: msg.id,
    conversationId: msg.conversation_id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    metadata: msg.metadata || undefined,
    status: (msg.metadata?.status as MessageStatus) || 'complete',
    createdAt: msg.created_at,
  }));
}

/**
 * Add a message to a conversation.
 */
export async function addMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<ConversationMessage> {
  const supabase = await createClient();

  // Verify conversation access
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add message: ${error.message}`);
  }

  // Auto-generate title if this is the first user message
  if (role === 'user' && conversation.title === 'New Conversation') {
    try {
      const title = await generateConversationTitle(content);
      await updateConversationTitle(conversationId, userId, title);
    } catch {
      // Silently fail title generation
    }
  }

  return {
    id: data.id,
    conversationId: data.conversation_id,
    role: data.role as 'user' | 'assistant',
    content: data.content,
    metadata: data.metadata || undefined,
    status: (data.metadata?.status as MessageStatus) || 'complete',
    createdAt: data.created_at,
  };
}

/**
 * Update an existing message (for streaming updates).
 *
 * Uses a single atomic update. For streaming, we only set status - we don't
 * need to merge with existing metadata since streaming messages start empty.
 */
export async function updateMessage(
  messageId: string,
  updates: {
    content?: string;
    status?: MessageStatus;
  }
): Promise<void> {
  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {};

  if (updates.content !== undefined) {
    updatePayload.content = updates.content;
  }

  if (updates.status !== undefined) {
    updatePayload.metadata = { status: updates.status };
  }

  const { error } = await supabase
    .from('conversation_messages')
    .update(updatePayload)
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }
}

/**
 * Get recent conversation for a case (to resume).
 */
export async function getRecentConversationForCase(
  userId: string,
  caseId: string
): Promise<Conversation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select()
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    caseId: data.case_id || undefined,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
