import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendCaseUpdateEmail,
  sendDocumentUploadedEmail,
  sendDeadlineReminderEmail,
  sendTeamInvitationEmail,
  sendBillingUpdateEmail,
} from './notifications';
import { sendEmail, shouldSendEmail } from './index';
import { WelcomeEmail } from './templates/welcome';
import { PasswordResetEmail } from './templates/password-reset';
import { TeamInvitationEmail } from './templates/team-invitation';
import { createClient } from '@/lib/supabase/server';
import { createMockChain, createMockSupabaseFrom } from '@/test-utils/mock-supabase-chain';

vi.mock('./index', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  shouldSendEmail: vi.fn().mockResolvedValue(true),
  EMAIL_CONFIG: { from: 'test@example.com', replyTo: 'reply@example.com' },
}));

vi.mock('./templates/welcome', () => ({ WelcomeEmail: vi.fn().mockReturnValue('welcome-html') }));
vi.mock('./templates/case-update', () => ({ CaseUpdateEmail: vi.fn().mockReturnValue('case-update-html') }));
vi.mock('./templates/document-uploaded', () => ({ DocumentUploadedEmail: vi.fn().mockReturnValue('doc-uploaded-html') }));
vi.mock('./templates/deadline-reminder', () => ({ DeadlineReminderEmail: vi.fn().mockReturnValue('deadline-html') }));
vi.mock('./templates/team-invitation', () => ({ TeamInvitationEmail: vi.fn().mockReturnValue('team-invite-html') }));
vi.mock('./templates/billing-update', () => ({ BillingUpdateEmail: vi.fn().mockReturnValue('billing-html') }));
vi.mock('./templates/password-reset', () => ({ PasswordResetEmail: vi.fn().mockReturnValue('reset-html') }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const mockCaseData = {
  id: 'case-1',
  title: 'Test Case',
  client_id: 'client-1',
  attorney_id: 'attorney-1',
  client: { id: 'client-1', email: 'client@test.com', first_name: 'John' },
  attorney: { id: 'attorney-1', email: 'attorney@test.com', first_name: 'Jane' },
};

const mockProfile = {
  id: 'attorney-1',
  email: 'attorney@test.com',
  first_name: 'Jane',
  last_name: 'Doe',
};

describe('notifications', () => {
  const mockSupabase = createMockSupabaseFrom();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(shouldSendEmail).mockResolvedValue(true);
    vi.mocked(sendEmail).mockResolvedValue({ success: true });
  });

  describe('sendWelcomeEmail', () => {
    it('calls sendEmail with correct params', async () => {
      await sendWelcomeEmail('user-1', 'test@test.com', 'Alice');

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@test.com',
          subject: 'Welcome to Immigration AI!',
          react: 'welcome-html',
        }),
        'user-1',
        'welcome',
        { firstName: 'Alice' }
      );
    });

    it('passes userName and loginUrl to WelcomeEmail template', async () => {
      await sendWelcomeEmail('user-1', 'test@test.com', 'Alice');

      expect(WelcomeEmail).toHaveBeenCalledWith({
        userName: 'Alice',
        loginUrl: 'https://immigrationai.app/login',
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('calls sendEmail with email, subject, and resetUrl', async () => {
      await sendPasswordResetEmail('test@test.com', 'https://reset.url/token');

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@test.com',
          subject: 'Reset Your Immigration AI Password',
          react: 'reset-html',
        }),
        undefined,
        'password_reset',
        { email: 'test@test.com' }
      );
    });

    it('defaults userName to User', async () => {
      await sendPasswordResetEmail('test@test.com', 'https://reset.url/token');

      expect(PasswordResetEmail).toHaveBeenCalledWith({
        userName: 'User',
        resetUrl: 'https://reset.url/token',
        expiresIn: '1 hour',
      });
    });
  });

  describe('sendCaseUpdateEmail', () => {
    it('when attorney updates, sends email to client', async () => {
      const casesChain = createMockChain({ data: mockCaseData, error: null });
      const profilesChain = createMockChain({ data: mockProfile, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') return casesChain;
        if (table === 'profiles') return profilesChain;
        return createMockChain({ data: null, error: null });
      });

      await sendCaseUpdateEmail('case-1', 'status_change', 'Status updated', 'attorney-1');

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com',
          subject: 'Case Update: Test Case',
        }),
        'client-1',
        'case_update',
        { caseId: 'case-1', updateType: 'status_change' }
      );
    });

    it('does not send email when shouldSendEmail returns false', async () => {
      const casesChain = createMockChain({ data: mockCaseData, error: null });
      const profilesChain = createMockChain({ data: mockProfile, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') return casesChain;
        if (table === 'profiles') return profilesChain;
        return createMockChain({ data: null, error: null });
      });

      vi.mocked(shouldSendEmail).mockResolvedValue(false);

      await sendCaseUpdateEmail('case-1', 'status_change', 'Status updated', 'attorney-1');

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('returns early when case is not found', async () => {
      const casesChain = createMockChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(casesChain);

      await sendCaseUpdateEmail('case-999', 'status_change', 'Status updated', 'attorney-1');

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendDocumentUploadedEmail', () => {
    it('when attorney uploads, notifies client', async () => {
      const casesChain = createMockChain({ data: mockCaseData, error: null });
      const profilesChain = createMockChain({ data: mockProfile, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'cases') return casesChain;
        if (table === 'profiles') return profilesChain;
        return createMockChain({ data: null, error: null });
      });

      await sendDocumentUploadedEmail('case-1', 'passport.pdf', 'identity', 'attorney-1');

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com',
          subject: 'New Document: passport.pdf',
        }),
        'client-1',
        'document_uploaded',
        { caseId: 'case-1', documentName: 'passport.pdf' }
      );
    });

    it('returns early when case is not found', async () => {
      const casesChain = createMockChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(casesChain);

      await sendDocumentUploadedEmail('case-999', 'file.pdf', 'identity', 'attorney-1');

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendDeadlineReminderEmail', () => {
    it('sends when shouldSendEmail returns true and user exists', async () => {
      const profilesChain = createMockChain({ data: mockProfile, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      const deadline = new Date('2026-03-15T00:00:00Z');
      await sendDeadlineReminderEmail('attorney-1', 'case-1', 'Test Case', deadline, 7);

      expect(shouldSendEmail).toHaveBeenCalledWith('attorney-1', 'deadline_reminders');
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'attorney@test.com',
          subject: 'Deadline Reminder: Test Case (7 days)',
        }),
        'attorney-1',
        'deadline_reminder',
        { caseId: 'case-1', daysUntil: 7 }
      );
    });

    it('does not send when shouldSendEmail returns false', async () => {
      vi.mocked(shouldSendEmail).mockResolvedValue(false);

      await sendDeadlineReminderEmail('user-1', 'case-1', 'Test Case', new Date(), 3);

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('does not send when user is not found', async () => {
      const profilesChain = createMockChain({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      await sendDeadlineReminderEmail('unknown-user', 'case-1', 'Test Case', new Date(), 3);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendTeamInvitationEmail', () => {
    it('sends with invite token and formatted expiry date', async () => {
      const expiresAt = new Date('2026-03-01T00:00:00Z');
      await sendTeamInvitationEmail(
        'invitee@test.com',
        'Alice Admin',
        'Immigration Firm',
        'attorney',
        'token-abc',
        expiresAt
      );

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invitee@test.com',
          subject: "You've been invited to join Immigration Firm on Immigration AI",
        }),
        undefined,
        'team_invitation',
        { firmName: 'Immigration Firm', role: 'attorney' }
      );
    });

    it('defaults expiry to 7 days from now when not provided', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await sendTeamInvitationEmail(
        'invitee@test.com',
        'Alice',
        'Firm',
        'paralegal',
        'token-xyz'
      );

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(sendEmail).mock.calls[0];
      expect(callArgs[2]).toBe('team_invitation');

      // Verify the template received a formatted expiry date 7 days from now
      const templateCallArgs = vi.mocked(TeamInvitationEmail).mock.calls[0][0];
      const expectedExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(templateCallArgs.expiresAt).toBe(expectedExpiry);

      vi.spyOn(Date, 'now').mockRestore();
    });
  });

  describe('sendBillingUpdateEmail', () => {
    it('sends when preferences allow', async () => {
      const profilesChain = createMockChain({ data: mockProfile, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      await sendBillingUpdateEmail('attorney-1', 'subscription_created', { planName: 'Pro' });

      expect(shouldSendEmail).toHaveBeenCalledWith('attorney-1', 'billing_updates');
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'attorney@test.com',
          subject: 'Welcome to Pro - Immigration AI',
        }),
        'attorney-1',
        'billing_update',
        { eventType: 'subscription_created' }
      );
    });

    it('does not send when shouldSendEmail returns false', async () => {
      vi.mocked(shouldSendEmail).mockResolvedValue(false);

      await sendBillingUpdateEmail('attorney-1', 'subscription_created', { planName: 'Pro' });

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('uses correct subject for subscription_created', async () => {
      const profilesChain = createMockChain({ data: mockProfile, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      await sendBillingUpdateEmail('attorney-1', 'subscription_created', { planName: 'Enterprise' });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Welcome to Enterprise - Immigration AI',
        }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('uses correct subject for payment_failed', async () => {
      const profilesChain = createMockChain({ data: mockProfile, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      await sendBillingUpdateEmail('attorney-1', 'payment_failed', {});

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Action required: Payment failed - Immigration AI',
        }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('uses correct subject for subscription_cancelled', async () => {
      const profilesChain = createMockChain({ data: mockProfile, error: null });
      mockSupabase.from.mockReturnValue(profilesChain);

      await sendBillingUpdateEmail('attorney-1', 'subscription_cancelled', {});

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Your subscription has been cancelled - Immigration AI',
        }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
