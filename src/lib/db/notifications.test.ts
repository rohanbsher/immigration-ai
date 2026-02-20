import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockQueryBuilder,
  resetMocks,
} from '@/__mocks__/supabase';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

import { notificationsService } from './notifications';

const createMockNotification = (overrides = {}) => ({
  id: 'notif-123',
  user_id: 'user-123',
  title: 'Test Notification',
  message: 'This is a test notification',
  type: 'info',
  read: false,
  action_url: '/dashboard/cases/123',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('NotificationsService', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should fetch notifications for a user with default options', async () => {
      const mockNotifs = [
        createMockNotification(),
        createMockNotification({ id: 'notif-456' }),
      ];
      const queryBuilder = createMockQueryBuilder(mockNotifs);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.getNotifications('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(queryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(2);
    });

    it('should filter unread only when specified', async () => {
      const mockNotifs = [createMockNotification({ read: false })];
      const queryBuilder = createMockQueryBuilder(mockNotifs);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.getNotifications('user-123', { unreadOnly: true });

      expect(queryBuilder.eq).toHaveBeenCalledWith('read', false);
    });

    it('should not filter by read status when unreadOnly is false', async () => {
      const queryBuilder = createMockQueryBuilder([createMockNotification()]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.getNotifications('user-123', { unreadOnly: false });

      // eq is called with 'user_id' but NOT with 'read', false
      const eqCalls = queryBuilder.eq.mock.calls;
      const readFilterCalls = eqCalls.filter(
        ([key]: [string]) => key === 'read'
      );
      expect(readFilterCalls).toHaveLength(0);
    });

    it('should use custom limit', async () => {
      const queryBuilder = createMockQueryBuilder([createMockNotification()]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.getNotifications('user-123', { limit: 10 });

      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no notifications found', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.getNotifications('user-123');

      expect(result).toEqual([]);
    });

    it('should throw error when query fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.limit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        notificationsService.getNotifications('user-123')
      ).rejects.toThrow();
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([]),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        })),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.getUnreadCount('user-123');

      expect(queryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(5);
    });

    it('should return 0 on query error', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([]),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: { message: 'Query failed' },
          }),
        })),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.getUnreadCount('user-123');

      expect(result).toBe(0);
    });

    it('should return 0 when count is null', async () => {
      const queryBuilder = {
        ...createMockQueryBuilder([]),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: null,
          }),
        })),
      };
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.getUnreadCount('user-123');

      expect(result).toBe(0);
    });

    it('should return 0 on exception', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      // getUnreadCount catches exceptions and returns 0
      const result = await notificationsService.getUnreadCount('user-123');

      expect(result).toBe(0);
    });
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const mockNotif = createMockNotification();
      const queryBuilder = createMockQueryBuilder([mockNotif]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      const result = await notificationsService.createNotification({
        user_id: 'user-123',
        title: 'Test',
        message: 'Test message',
        type: 'success',
        action_url: '/dashboard/cases/1',
      });

      expect(queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: 'Test',
        message: 'Test message',
        type: 'success',
        action_url: '/dashboard/cases/1',
        read: false,
      });
      expect(result).toBeDefined();
    });

    it('should default type to info when not specified', async () => {
      const mockNotif = createMockNotification();
      const queryBuilder = createMockQueryBuilder([mockNotif]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.createNotification({
        user_id: 'user-123',
        title: 'Test',
        message: 'Test message',
      });

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'info' })
      );
    });

    it('should always set read to false', async () => {
      const mockNotif = createMockNotification();
      const queryBuilder = createMockQueryBuilder([mockNotif]);
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.createNotification({
        user_id: 'user-123',
        title: 'Test',
        message: 'Test',
      });

      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ read: false })
      );
    });

    it('should throw error when insert fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        notificationsService.createNotification({
          user_id: 'user-123',
          title: 'Test',
          message: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('markAsRead', () => {
    it('should mark a specific notification as read', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.markAsRead('notif-123', 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(queryBuilder.update).toHaveBeenCalledWith({ read: true });
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'notif-123');
      expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should scope to user_id for security', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.markAsRead('notif-123', 'user-123');

      // Both id and user_id constraints are applied
      const eqCalls = queryBuilder.eq.mock.calls;
      expect(eqCalls).toContainEqual(['id', 'notif-123']);
      expect(eqCalls).toContainEqual(['user_id', 'user-123']);
    });

    it('should throw error when update fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        notificationsService.markAsRead('notif-123', 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a user', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn().mockReturnThis();
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.markAllAsRead('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(queryBuilder.update).toHaveBeenCalledWith({ read: true });
      expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(queryBuilder.eq).toHaveBeenCalledWith('read', false);
    });

    it('should throw error when bulk update fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: { message: 'Bulk update failed' } });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        notificationsService.markAllAsRead('user-123')
      ).rejects.toThrow();
    });
  });

  describe('deleteNotification', () => {
    it('should delete a specific notification', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await notificationsService.deleteNotification('notif-123', 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(queryBuilder.delete).toHaveBeenCalled();
      expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'notif-123');
      expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should throw error when delete fails', async () => {
      const queryBuilder = createMockQueryBuilder([]);
      queryBuilder.eq = vi.fn()
        .mockReturnValueOnce(queryBuilder)
        .mockResolvedValueOnce({ data: null, error: { message: 'Delete failed' } });
      mockSupabase.from.mockReturnValue(queryBuilder);

      await expect(
        notificationsService.deleteNotification('notif-123', 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('helper notification methods', () => {
    beforeEach(() => {
      const mockNotif = createMockNotification();
      const queryBuilder = createMockQueryBuilder([mockNotif]);
      mockSupabase.from.mockReturnValue(queryBuilder);
    });

    it('notifyDocumentUploaded should create info notification', async () => {
      const result = await notificationsService.notifyDocumentUploaded(
        'user-123',
        'passport.pdf',
        'case-456'
      );

      expect(result).toBeDefined();
      const queryBuilder = mockSupabase.from.mock.results[0].value;
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Document Uploaded',
          type: 'info',
          action_url: '/dashboard/cases/case-456?tab=documents',
        })
      );
    });

    it('notifyDocumentVerified should create success notification', async () => {
      const result = await notificationsService.notifyDocumentVerified(
        'user-123',
        'passport.pdf',
        'case-456'
      );

      expect(result).toBeDefined();
      const queryBuilder = mockSupabase.from.mock.results[0].value;
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Document Verified',
          type: 'success',
          action_url: '/dashboard/cases/case-456?tab=documents',
        })
      );
    });

    it('notifyFormReady should create info notification', async () => {
      const result = await notificationsService.notifyFormReady(
        'user-123',
        'I-130',
        'case-456'
      );

      expect(result).toBeDefined();
      const queryBuilder = mockSupabase.from.mock.results[0].value;
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Form Ready for Review',
          type: 'info',
          action_url: '/dashboard/cases/case-456?tab=forms',
        })
      );
    });

    it('notifyDeadlineApproaching should create warning notification', async () => {
      const result = await notificationsService.notifyDeadlineApproaching(
        'user-123',
        'H1B Case',
        '2024-06-15',
        'case-456'
      );

      expect(result).toBeDefined();
      const queryBuilder = mockSupabase.from.mock.results[0].value;
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Deadline Approaching',
          type: 'warning',
          action_url: '/dashboard/cases/case-456',
        })
      );
    });

    it('notifyStatusChanged should create info notification', async () => {
      const result = await notificationsService.notifyStatusChanged(
        'user-123',
        'H1B Case',
        'in_review',
        'case-456'
      );

      expect(result).toBeDefined();
      const queryBuilder = mockSupabase.from.mock.results[0].value;
      expect(queryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Case Status Updated',
          type: 'info',
          action_url: '/dashboard/cases/case-456',
        })
      );
    });

    it('notification messages should include relevant details', async () => {
      await notificationsService.notifyDocumentUploaded(
        'user-123',
        'employment-letter.pdf',
        'case-789'
      );

      const queryBuilder = mockSupabase.from.mock.results[0].value;
      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.message).toContain('employment-letter.pdf');
    });
  });
});
