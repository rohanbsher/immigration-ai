import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('db:case-messages');

export interface CaseMessage {
  id: string;
  case_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
  deleted_at: string | null;
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    avatar_url: string | null;
  };
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface CreateMessageData {
  case_id: string;
  sender_id: string;
  content: string;
}

export interface CreateAttachmentData {
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

export const caseMessagesService = {
  /**
   * Get all messages for a case
   */
  async getMessages(
    caseId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ data: CaseMessage[]; total: number }> {
    const supabase = await createClient();
    const { limit = 50, offset = 0 } = options;

    // Get total count
    const { count } = await supabase
      .from('case_messages')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .is('deleted_at', null);

    // Get messages with sender info
    const { data, error } = await supabase
      .from('case_messages')
      .select(`
        *,
        sender:profiles!sender_id (
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url
        ),
        attachments:message_attachments (*)
      `)
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.logError('Error fetching messages', error, { caseId });
      throw error;
    }

    return {
      data: data as CaseMessage[],
      total: count || 0,
    };
  },

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<CaseMessage | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('case_messages')
      .select(`
        *,
        sender:profiles!sender_id (
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url
        ),
        attachments:message_attachments (*)
      `)
      .eq('id', messageId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.logError('Error fetching message', error, { messageId });
      throw error;
    }

    return data as CaseMessage;
  },

  /**
   * Create a new message
   */
  async createMessage(data: CreateMessageData): Promise<CaseMessage> {
    const supabase = await createClient();

    const { data: message, error } = await supabase
      .from('case_messages')
      .insert(data)
      .select(`
        *,
        sender:profiles!sender_id (
          id,
          first_name,
          last_name,
          email,
          role,
          avatar_url
        )
      `)
      .single();

    if (error) {
      logger.logError('Error creating message', error, { caseId: data.case_id, senderId: data.sender_id });
      throw error;
    }

    return message as CaseMessage;
  },

  /**
   * Add an attachment to a message
   */
  async addAttachment(data: CreateAttachmentData): Promise<MessageAttachment> {
    const supabase = await createClient();

    const { data: attachment, error } = await supabase
      .from('message_attachments')
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.logError('Error adding attachment', error, { messageId: data.message_id, fileName: data.file_name });
      throw error;
    }

    return attachment as MessageAttachment;
  },

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('case_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .is('read_at', null);

    if (error) {
      logger.logError('Error marking message as read', error, { messageId });
      throw error;
    }
  },

  /**
   * Mark all messages in a case as read for a user
   */
  async markAllAsRead(caseId: string, userId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('case_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('case_id', caseId)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) {
      logger.logError('Error marking all messages as read', error, { caseId, userId });
      throw error;
    }
  },

  /**
   * Soft delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('case_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      logger.logError('Error deleting message', error, { messageId });
      throw error;
    }
  },

  /**
   * Get unread message count for a user across all their cases
   */
  async getUnreadCount(userId: string): Promise<number> {
    const supabase = await createClient();

    // Get cases where user is client or attorney
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('id')
      .or(`client_id.eq.${userId},attorney_id.eq.${userId}`)
      .is('deleted_at', null);

    if (casesError) {
      logger.logError('Error fetching cases for unread count', casesError, { userId });
      return 0;
    }

    if (!cases || cases.length === 0) return 0;

    const caseIds = cases.map((c) => c.id);

    // Count unread messages (not sent by user)
    const { count, error } = await supabase
      .from('case_messages')
      .select('*', { count: 'exact', head: true })
      .in('case_id', caseIds)
      .neq('sender_id', userId)
      .is('read_at', null)
      .is('deleted_at', null);

    if (error) {
      logger.logError('Error fetching unread count', error, { userId });
      return 0;
    }

    return count || 0;
  },

  /**
   * Get unread count for a specific case
   */
  async getUnreadCountForCase(caseId: string, userId: string): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('case_messages')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .neq('sender_id', userId)
      .is('read_at', null)
      .is('deleted_at', null);

    if (error) {
      logger.logError('Error fetching unread count for case', error, { caseId, userId });
      return 0;
    }

    return count || 0;
  },
};
