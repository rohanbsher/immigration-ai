import { BaseService } from './base-service';

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

class NotificationsService extends BaseService {
  constructor() {
    super('notifications');
  }

  async getNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
  ): Promise<Notification[]> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();
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

      if (error) throw error;

      return data as Notification[];
    }, 'getNotifications', { userId });
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const supabase = await this.getSupabaseClient();

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        this.logger.logError('Error in getUnreadCount', error, { userId });
        return 0;
      }

      return count || 0;
    } catch (error) {
      this.logger.logError('Error in getUnreadCount', error, { userId });
      return 0;
    }
  }

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          ...data,
          type: data.type || 'info',
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      return notification;
    }, 'createNotification', { userId: data.user_id, title: data.title });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    }, 'markAsRead', { notificationId: id, userId });
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    }, 'markAllAsRead', { userId });
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    return this.withErrorHandling(async () => {
      const supabase = await this.getSupabaseClient();

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    }, 'deleteNotification', { notificationId: id, userId });
  }

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
  }

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
  }

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
  }

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
  }

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
  }
}

// Export singleton instance
export const notificationsService = new NotificationsService();
