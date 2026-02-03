// Note: No 'use server' directive - incompatible with object exports.
// This module is only imported by API routes (server-side).

import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { generateConversationTitle } from '@/lib/ai/chat';
import { rpcWithFallback } from '@/lib/supabase/rpc-fallback';

const logger = createLogger('db:conversations');

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
 * Options for listing conversations.
 */
export interface GetConversationsOptions {
  caseId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Transform database row to Conversation type.
 * Validates required fields before type assertion.
 */
function toConversation(row: Record<string, unknown>): Conversation {
  if (!row.id || !row.user_id || !row.title) {
    throw new Error('Invalid conversation row: missing required fields (id, user_id, or title)');
  }
  return {
    id: row.id as string,
    userId: row.user_id as string,
    caseId: (row.case_id as string) || undefined,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Transform database row to ConversationMessage type.
 * Validates required fields before type assertion.
 */
function toMessage(row: Record<string, unknown>): ConversationMessage {
  if (!row.id || !row.conversation_id || !row.role || row.content === undefined) {
    throw new Error('Invalid message row: missing required fields (id, conversation_id, role, or content)');
  }
  const metadata = row.metadata as Record<string, unknown> | null;
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    metadata: metadata || undefined,
    status: (metadata?.status as MessageStatus) || 'complete',
    createdAt: row.created_at as string,
  };
}

/**
 * Conversations service - provides all conversation-related database operations.
 *
 * Follows the same service object pattern as other db services (cases, clients, etc.)
 */
export const conversationsService = {
  /**
   * Create a new conversation.
   */
  async create(
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
      logger.logError('Failed to create conversation', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return toConversation(data);
  },

  /**
   * Get a conversation by ID.
   */
  async getById(
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

    return toConversation(data);
  },

  /**
   * Get all conversations for a user.
   */
  async list(
    userId: string,
    options?: GetConversationsOptions
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
      logger.logError('Failed to get conversations', error);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return (data || []).map(toConversation);
  },

  /**
   * Update conversation title.
   */
  async updateTitle(
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
      logger.logError('Failed to update conversation', error, { conversationId });
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  },

  /**
   * Delete a conversation.
   */
  async delete(conversationId: string, userId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      logger.logError('Failed to delete conversation', error, { conversationId });
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  },

  /**
   * Get recent conversation for a case (to resume).
   */
  async getRecentForCase(
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

    return toConversation(data);
  },

  /**
   * Get messages for a conversation.
   */
  async getMessages(
    conversationId: string,
    userId: string
  ): Promise<ConversationMessage[]> {
    // Verify conversation access
    const conversation = await this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('conversation_messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.logError('Failed to get messages', error, { conversationId });
      throw new Error(`Failed to get messages: ${error.message}`);
    }

    return (data || []).map(toMessage);
  },

  /**
   * Add a message to a conversation.
   */
  async addMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ConversationMessage> {
    // Verify conversation access
    const conversation = await this.getById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const supabase = await createClient();

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
      logger.logError('Failed to add message', error, { conversationId });
      throw new Error(`Failed to add message: ${error.message}`);
    }

    // Auto-generate title if this is the first user message
    if (role === 'user' && conversation.title === 'New Conversation') {
      try {
        const title = await generateConversationTitle(content);
        await this.updateTitle(conversationId, userId, title);
      } catch {
        // Silently fail title generation
      }
    }

    return toMessage(data);
  },

  /**
   * Update an existing message (for streaming updates).
   *
   * Uses atomic RPC with JSONB merge to prevent race conditions
   * where concurrent updates could overwrite each other's metadata.
   *
   * Falls back to manual fetch-then-update if the RPC function
   * doesn't exist (migration not applied yet).
   */
  async updateMessage(
    messageId: string,
    updates: {
      content?: string;
      status?: MessageStatus;
    }
  ): Promise<void> {
    if (!updates.content && !updates.status) {
      return; // Nothing to update
    }

    const supabase = await createClient();

    await rpcWithFallback({
      supabase,
      rpcName: 'update_message_with_metadata',
      rpcParams: {
        p_message_id: messageId,
        p_content: updates.content ?? null,
        p_status: updates.status ?? null,
      },
      fallback: async () => {
        // Fallback: fetch-then-update (original behavior with race condition)
        // This path is only used when migration 029 hasn't been applied yet
        const { data: existing, error: fetchError } = await supabase
          .from('conversation_messages')
          .select('metadata')
          .eq('id', messageId)
          .single();

        if (fetchError) {
          logger.logError('Failed to fetch message for fallback update', fetchError, { messageId });
          throw new Error(`Failed to fetch message: ${fetchError.message}`);
        }

        const updateData: Record<string, unknown> = {};
        if (updates.content) {
          updateData.content = updates.content;
        }
        if (updates.status) {
          updateData.metadata = {
            ...(existing?.metadata ?? {}),
            status: updates.status,
          };
        }

        const { error: updateError } = await supabase
          .from('conversation_messages')
          .update(updateData)
          .eq('id', messageId);

        if (updateError) {
          logger.logError('Failed to update message (fallback)', updateError, { messageId });
          throw new Error(`Failed to update message: ${updateError.message}`);
        }
      },
      logContext: { messageId },
    });
  },
};

// ============================================================================
// Backward-compatible function exports
// These wrap the service methods to maintain existing API compatibility
// ============================================================================

export async function createConversation(
  userId: string,
  caseId?: string,
  title?: string
): Promise<Conversation> {
  return conversationsService.create(userId, caseId, title);
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<Conversation | null> {
  return conversationsService.getById(conversationId, userId);
}

export async function getConversations(
  userId: string,
  options?: GetConversationsOptions
): Promise<Conversation[]> {
  return conversationsService.list(userId, options);
}

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  return conversationsService.updateTitle(conversationId, userId, title);
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  return conversationsService.delete(conversationId, userId);
}

export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<ConversationMessage[]> {
  return conversationsService.getMessages(conversationId, userId);
}

export async function addMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<ConversationMessage> {
  return conversationsService.addMessage(conversationId, userId, role, content, metadata);
}

export async function updateMessage(
  messageId: string,
  updates: {
    content?: string;
    status?: MessageStatus;
  }
): Promise<void> {
  return conversationsService.updateMessage(messageId, updates);
}

export async function getRecentConversationForCase(
  userId: string,
  caseId: string
): Promise<Conversation | null> {
  return conversationsService.getRecentForCase(userId, caseId);
}
