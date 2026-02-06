import { BaseService } from './base-service';

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

const MESSAGE_SELECT = `
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
`;

const MESSAGE_SELECT_NO_ATTACHMENTS = `
  *,
  sender:profiles!sender_id (
    id,
    first_name,
    last_name,
    email,
    role,
    avatar_url
  )
`;

class CaseMessagesService extends BaseService {
  constructor() {
    super('case-messages');
  }

  async getMessages(
    caseId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ data: CaseMessage[]; total: number }> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();
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
        .select(MESSAGE_SELECT)
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data as CaseMessage[],
        total: count || 0,
      };
    }, 'getMessages', { caseId });
  }

  async getMessage(messageId: string): Promise<CaseMessage | null> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data, error } = await supabase
        .from('case_messages')
        .select(MESSAGE_SELECT)
        .eq('id', messageId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as CaseMessage;
    }, 'getMessage', { messageId });
  }

  async createMessage(data: CreateMessageData): Promise<CaseMessage> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: message, error } = await supabase
        .from('case_messages')
        .insert(data)
        .select(MESSAGE_SELECT_NO_ATTACHMENTS)
        .single();

      if (error) throw error;

      return message as CaseMessage;
    }, 'createMessage', { caseId: data.case_id, senderId: data.sender_id });
  }

  async addAttachment(data: CreateAttachmentData): Promise<MessageAttachment> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: attachment, error } = await supabase
        .from('message_attachments')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      return attachment as MessageAttachment;
    }, 'addAttachment', { messageId: data.message_id, fileName: data.file_name });
  }

  async markAsRead(messageId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('case_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId)
        .is('read_at', null);

      if (error) throw error;
    }, 'markAsRead', { messageId });
  }

  async markAllAsRead(caseId: string, userId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('case_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('case_id', caseId)
        .neq('sender_id', userId)
        .is('read_at', null);

      if (error) throw error;
    }, 'markAllAsRead', { caseId, userId });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('case_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
    }, 'deleteMessage', { messageId });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      // Get cases where user is client or attorney
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id')
        .or(`client_id.eq.${userId},attorney_id.eq.${userId}`)
        .is('deleted_at', null);

      if (casesError) throw casesError;

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

      if (error) throw error;

      return count || 0;
    }, 'getUnreadCount', { userId });
  }

  async getUnreadCountForCase(caseId: string, userId: string): Promise<number> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { count, error } = await supabase
        .from('case_messages')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', caseId)
        .neq('sender_id', userId)
        .is('read_at', null)
        .is('deleted_at', null);

      if (error) throw error;

      return count || 0;
    }, 'getUnreadCountForCase', { caseId, userId });
  }
}

// Export singleton instance
export const caseMessagesService = new CaseMessagesService();
