import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SendEmailOptions } from './index';

const mockResendSend = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseRpc = vi.fn();
const mockSupabaseUpsert = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseSingle = vi.fn();

const mockSupabaseChain = {
  insert: mockSupabaseInsert,
  update: mockSupabaseUpdate,
  select: mockSupabaseSelect,
  upsert: mockSupabaseUpsert,
  eq: mockSupabaseEq,
  single: mockSupabaseSingle,
};

mockSupabaseInsert.mockReturnValue(mockSupabaseChain);
mockSupabaseUpdate.mockReturnValue(mockSupabaseChain);
mockSupabaseSelect.mockReturnValue(mockSupabaseChain);
mockSupabaseUpsert.mockReturnValue(mockSupabaseChain);
mockSupabaseEq.mockReturnValue(mockSupabaseChain);
mockSupabaseSingle.mockResolvedValue({ data: { id: 'log-123' }, error: null });

vi.mock('./client', () => ({
  resend: {
    emails: {
      send: mockResendSend,
    },
  },
  EMAIL_CONFIG: {
    from: 'CaseFill <noreply@casefill.ai>',
    replyTo: 'support@casefill.ai',
    appName: 'CaseFill',
    appUrl: 'https://casefill.ai',
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: vi.fn(() => mockSupabaseChain),
    rpc: mockSupabaseRpc,
  }),
}));

describe('Email Module', () => {
  let sendEmail: (
    options: SendEmailOptions,
    userId?: string,
    templateName?: string,
    templateData?: Record<string, unknown>
  ) => Promise<{ success: boolean; messageId?: string; error?: string }>;

  let shouldSendEmail: (userId: string, emailType: string) => Promise<boolean>;
  let getNotificationPreferences: (userId: string) => Promise<unknown>;
  let updateNotificationPreferences: (
    userId: string,
    preferences: Record<string, unknown>
  ) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSupabaseSingle.mockResolvedValue({ data: { id: 'log-123' }, error: null });

    const emailModule = await import('./index');
    sendEmail = emailModule.sendEmail;
    shouldSendEmail = emailModule.shouldSendEmail;
    getNotificationPreferences = emailModule.getNotificationPreferences;
    updateNotificationPreferences = emailModule.updateNotificationPreferences;
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-msg-123' },
        error: null,
      });

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-msg-123');
      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'CaseFill <noreply@casefill.ai>',
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello</p>',
        react: undefined,
        text: undefined,
        replyTo: 'support@casefill.ai',
        cc: undefined,
        bcc: undefined,
        tags: undefined,
      });
    });

    it('should send email to multiple recipients', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-msg-456' },
        error: null,
      });

      const result = await sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Batch Email',
        html: '<p>Hello all</p>',
      });

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        })
      );
    });

    it('should use custom replyTo when provided', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-msg-789' },
        error: null,
      });

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        replyTo: 'custom@example.com',
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'custom@example.com',
        })
      );
    });

    it('should include cc and bcc recipients', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-msg-cc' },
        error: null,
      });

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        cc: ['cc1@example.com'],
        bcc: ['bcc1@example.com'],
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['cc1@example.com'],
          bcc: ['bcc1@example.com'],
        })
      );
    });

    it('should include tags in the email', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-msg-tags' },
        error: null,
      });

      const tags = [{ name: 'category', value: 'notification' }];

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        tags,
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({ tags })
      );
    });

    it('should handle Resend API error', async () => {
      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded' },
      });

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle network/exception errors', async () => {
      mockResendSend.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockResendSend.mockRejectedValueOnce('String error');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('shouldSendEmail', () => {
    it('should return true when RPC returns true', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: true });

      const result = await shouldSendEmail('user-123', 'case_update');

      expect(result).toBe(true);
      expect(mockSupabaseRpc).toHaveBeenCalledWith('should_send_email', {
        p_user_id: 'user-123',
        p_email_type: 'case_update',
      });
    });

    it('should return false when RPC returns false', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: false });

      const result = await shouldSendEmail('user-123', 'marketing');

      expect(result).toBe(false);
    });

    it('should return false when RPC returns null', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({ data: null });

      const result = await shouldSendEmail('user-123', 'unknown_type');

      expect(result).toBe(false);
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return notification preferences', async () => {
      const mockPreferences = {
        email_enabled: true,
        email_case_updates: true,
        email_deadline_reminders: true,
      };

      mockSupabaseRpc.mockResolvedValueOnce({ data: mockPreferences, error: null });

      const result = await getNotificationPreferences('user-123');

      expect(result).toEqual(mockPreferences);
      expect(mockSupabaseRpc).toHaveBeenCalledWith(
        'get_or_create_notification_preferences',
        { p_user_id: 'user-123' }
      );
    });

    it('should throw error on RPC failure', async () => {
      mockSupabaseRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(getNotificationPreferences('user-123')).rejects.toThrow(
        'Failed to get notification preferences: Database error'
      );
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences successfully', async () => {
      const updatedPreferences = {
        email_enabled: true,
        email_case_updates: false,
      };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { user_id: 'user-123', ...updatedPreferences },
        error: null,
      });

      const result = await updateNotificationPreferences(
        'user-123',
        updatedPreferences
      );

      expect(result).toEqual({
        user_id: 'user-123',
        ...updatedPreferences,
      });
    });

    it('should throw error on update failure', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        updateNotificationPreferences('user-123', { email_enabled: false })
      ).rejects.toThrow('Failed to update notification preferences: Update failed');
    });

    it('should update timezone preference', async () => {
      const preferences = { timezone: 'America/New_York' };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { user_id: 'user-123', timezone: 'America/New_York' },
        error: null,
      });

      const result = await updateNotificationPreferences('user-123', preferences);

      expect(result.timezone).toBe('America/New_York');
    });

    it('should update deadline reminder days', async () => {
      const preferences = { deadline_reminder_days: [1, 3, 7] };

      mockSupabaseSingle.mockResolvedValueOnce({
        data: { user_id: 'user-123', deadline_reminder_days: [1, 3, 7] },
        error: null,
      });

      const result = await updateNotificationPreferences('user-123', preferences);

      expect(result.deadline_reminder_days).toEqual([1, 3, 7]);
    });
  });
});

describe('Email Module - Resend Not Configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should handle missing Resend configuration', async () => {
    vi.doMock('./client', () => ({
      resend: null,
      EMAIL_CONFIG: {
        from: 'CaseFill <noreply@casefill.ai>',
        replyTo: 'support@casefill.ai',
        appName: 'CaseFill',
        appUrl: 'https://casefill.ai',
      },
    }));

    vi.doMock('@/lib/supabase/server', () => ({
      createClient: async () => ({
        from: vi.fn(() => ({
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: 'log-123' }, error: null })
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }),
    }));

    const { sendEmail } = await import('./index');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Email service not configured');
  });
});
