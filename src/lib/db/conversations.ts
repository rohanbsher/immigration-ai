// Note: No 'use server' directive - incompatible with object exports.
// This module is only imported by API routes (server-side).

import { BaseService } from './base-service';
import { generateConversationTitle } from '@/lib/ai/chat';
import { rpcWithFallback } from '@/lib/supabase/rpc-fallback';

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

class ConversationsServiceClass extends BaseService {
  constructor() {
    super('conversations');
  }

  async create(
    userId: string,
    caseId?: string,
    title?: string
  ): Promise<Conversation> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

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

      return toConversation(data);
    }, 'create', { userId, caseId });
  }

  async getById(
    conversationId: string,
    userId: string
  ): Promise<Conversation | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('conversations')
        .select()
        .eq('id', conversationId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return null;
      }

      return toConversation(data);
    }, 'getById', { conversationId, userId });
  }

  async list(
    userId: string,
    options?: GetConversationsOptions
  ): Promise<Conversation[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      let query = supabase
        .from('conversations')
        .select()
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (options?.caseId) {
        query = query.eq('case_id', options.caseId);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      } else if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get conversations: ${error.message}`);
      }

      return (data || []).map(toConversation);
    }, 'list', { userId });
  }

  async updateTitle(
    conversationId: string,
    userId: string,
    title: string
  ): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update conversation: ${error.message}`);
      }
    }, 'updateTitle', { conversationId });
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      // Soft-delete to preserve attorney-client communication for compliance
      const { error } = await supabase
        .from('conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete conversation: ${error.message}`);
      }
    }, 'delete', { conversationId });
  }

  async getRecentForCase(
    userId: string,
    caseId: string
  ): Promise<Conversation | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('conversations')
        .select()
        .eq('user_id', userId)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return toConversation(data);
    }, 'getRecentForCase', { userId, caseId });
  }

  async getMessages(
    conversationId: string,
    userId: string
  ): Promise<ConversationMessage[]> {
    return this.withErrorHandling(async () => {
      // Verify conversation access
      const conversation = await this.getById(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('conversation_messages')
        .select()
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get messages: ${error.message}`);
      }

      return (data || []).map(toMessage);
    }, 'getMessages', { conversationId });
  }

  async addMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ConversationMessage> {
    return this.withErrorHandling(async () => {
      // Verify conversation access
      const conversation = await this.getById(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const supabase = await this.getSupabaseClient();

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
          await this.updateTitle(conversationId, userId, title);
        } catch {
          // Silently fail title generation
        }
      }

      return toMessage(data);
    }, 'addMessage', { conversationId });
  }

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

    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

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
            throw new Error(`Failed to update message: ${updateError.message}`);
          }
        },
        logContext: { messageId },
      });
    }, 'updateMessage', { messageId });
  }
}

// Export singleton instance
export const conversationsService = new ConversationsServiceClass();

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
