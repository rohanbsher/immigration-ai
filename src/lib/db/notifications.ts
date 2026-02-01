import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('db:notifications');

export type NotificationType = 'info' | 'warning' | 'success' | 'error';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface CreateNotificationData {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  action_url?: string;
}

export const notificationsService = {
  async getNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
  ): Promise<Notification[]> {
    const supabase = await createClient();
    const { unreadOnly = false, limit = 50 } = options;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;

    if (error) {
      logger.logError('Error fetching notifications', error, { userId });
      throw error;
    }

    return data as Notification[];
  },

  async getUnreadCount(userId: string): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      logger.logError('Error fetching unread count', error, { userId });
      return 0;
    }

    return count || 0;
  },

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    const supabase = await createClient();

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        ...data,
        type: data.type || 'info',
        read: false,
      })
      .select()
      .single();

    if (error) {
      logger.logError('Error creating notification', error, { userId: data.user_id, title: data.title });
      throw error;
    }

    return notification;
  },

  async markAsRead(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      logger.logError('Error marking notification as read', error, { notificationId: id });
      throw error;
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      logger.logError('Error marking all notifications as read', error, { userId });
      throw error;
    }
  },

  async deleteNotification(id: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      logger.logError('Error deleting notification', error, { notificationId: id });
      throw error;
    }
  },

  // Helper methods for creating common notifications
  async notifyDocumentUploaded(
    userId: string,
    documentName: string,
    caseId: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Document Uploaded',
      message: `A new document "${documentName}" has been uploaded to your case.`,
      type: 'info',
      action_url: `/dashboard/cases/${caseId}?tab=documents`,
    });
  },

  async notifyDocumentVerified(
    userId: string,
    documentName: string,
    caseId: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Document Verified',
      message: `Your document "${documentName}" has been verified.`,
      type: 'success',
      action_url: `/dashboard/cases/${caseId}?tab=documents`,
    });
  },

  async notifyFormReady(
    userId: string,
    formType: string,
    caseId: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Form Ready for Review',
      message: `Form ${formType} has been auto-filled and is ready for your review.`,
      type: 'info',
      action_url: `/dashboard/cases/${caseId}?tab=forms`,
    });
  },

  async notifyDeadlineApproaching(
    userId: string,
    caseName: string,
    deadline: string,
    caseId: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Deadline Approaching',
      message: `The deadline for "${caseName}" is approaching on ${deadline}.`,
      type: 'warning',
      action_url: `/dashboard/cases/${caseId}`,
    });
  },

  async notifyStatusChanged(
    userId: string,
    caseName: string,
    newStatus: string,
    caseId: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Case Status Updated',
      message: `The status of "${caseName}" has been updated to ${newStatus}.`,
      type: 'info',
      action_url: `/dashboard/cases/${caseId}`,
    });
  },
};
