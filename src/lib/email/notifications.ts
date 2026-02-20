import { sendEmail, shouldSendEmail } from './index';
import { WelcomeEmail } from './templates/welcome';
import { CaseUpdateEmail } from './templates/case-update';
import { DocumentUploadedEmail } from './templates/document-uploaded';
import { DeadlineReminderEmail } from './templates/deadline-reminder';
import { TeamInvitationEmail } from './templates/team-invitation';
import { BillingUpdateEmail } from './templates/billing-update';
import { PasswordResetEmail } from './templates/password-reset';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://casefill.ai';

interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name || 'User',
    lastName: profile.last_name || '',
  };
}

export async function sendWelcomeEmail(
  userId: string,
  email: string,
  firstName: string
): Promise<void> {
  const loginUrl = `${APP_URL}/login`;

  await sendEmail(
    {
      to: email,
      subject: 'Welcome to CaseFill!',
      react: WelcomeEmail({ userName: firstName, loginUrl }),
    },
    userId,
    'welcome',
    { firstName }
  );
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  userName: string = 'User'
): Promise<void> {
  await sendEmail(
    {
      to: email,
      subject: 'Reset Your CaseFill Password',
      react: PasswordResetEmail({
        userName,
        resetUrl,
        expiresIn: '1 hour',
      }),
    },
    undefined,
    'password_reset',
    { email }
  );
}

export async function sendCaseUpdateEmail(
  caseId: string,
  updateType: 'status_change' | 'document_added' | 'form_updated' | 'note_added',
  updateDescription: string,
  updatedByUserId: string
): Promise<void> {
  const supabase = await createClient();

  // Get case details
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      id,
      title,
      client_id,
      attorney_id,
      client:profiles!cases_client_id_fkey(id, email, first_name),
      attorney:profiles!cases_attorney_id_fkey(id, email, first_name)
    `)
    .eq('id', caseId)
    .single();

  if (!caseData) return;

  // Get updater info
  const updater = await getUserInfo(updatedByUserId);
  const updaterName = updater ? `${updater.firstName} ${updater.lastName}`.trim() : 'Unknown';

  const caseUrl = `${APP_URL}/dashboard/cases/${caseId}`;

  // Determine who to notify (the other party)
  const recipients: { userId: string; email: string; name: string }[] = [];

  // Extract client and attorney data from join (Supabase returns object for single foreign key join)
  type ProfileData = { id: string; email: string; first_name: string | null } | null;
  const clientData = caseData.client as unknown as ProfileData;
  const attorneyData = caseData.attorney as unknown as ProfileData;

  // If attorney updated, notify client
  if (
    updatedByUserId === caseData.attorney_id &&
    clientData?.email
  ) {
    recipients.push({
      userId: clientData.id,
      email: clientData.email,
      name: clientData.first_name || 'Client',
    });
  }

  // If client updated, notify attorney
  if (
    updatedByUserId === caseData.client_id &&
    attorneyData?.email
  ) {
    recipients.push({
      userId: attorneyData.id,
      email: attorneyData.email,
      name: attorneyData.first_name || 'Attorney',
    });
  }

  // Send emails to all recipients who have case_updates enabled
  for (const recipient of recipients) {
    const shouldSend = await shouldSendEmail(recipient.userId, 'case_updates');
    if (!shouldSend) continue;

    await sendEmail(
      {
        to: recipient.email,
        subject: `Case Update: ${caseData.title}`,
        react: CaseUpdateEmail({
          userName: recipient.name,
          caseTitle: caseData.title,
          updateType,
          updateDescription,
          caseUrl,
          updatedBy: updaterName,
        }),
      },
      recipient.userId,
      'case_update',
      { caseId, updateType }
    );
  }
}

export async function sendDocumentUploadedEmail(
  caseId: string,
  documentName: string,
  documentType: string,
  uploadedByUserId: string
): Promise<void> {
  const supabase = await createClient();

  // Get case details
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      id,
      title,
      client_id,
      attorney_id,
      client:profiles!cases_client_id_fkey(id, email, first_name),
      attorney:profiles!cases_attorney_id_fkey(id, email, first_name)
    `)
    .eq('id', caseId)
    .single();

  if (!caseData) return;

  // Get uploader info
  const uploader = await getUserInfo(uploadedByUserId);
  const uploaderName = uploader ? `${uploader.firstName} ${uploader.lastName}`.trim() : 'Unknown';

  const caseUrl = `${APP_URL}/dashboard/cases/${caseId}`;

  // Determine who to notify (the other party)
  const recipients: { userId: string; email: string; name: string }[] = [];

  // Extract client and attorney data from join
  type ProfileData = { id: string; email: string; first_name: string | null } | null;
  const clientData = caseData.client as unknown as ProfileData;
  const attorneyData = caseData.attorney as unknown as ProfileData;

  // If attorney uploaded, notify client
  if (
    uploadedByUserId === caseData.attorney_id &&
    clientData?.email
  ) {
    recipients.push({
      userId: clientData.id,
      email: clientData.email,
      name: clientData.first_name || 'Client',
    });
  }

  // If client uploaded, notify attorney
  if (
    uploadedByUserId === caseData.client_id &&
    attorneyData?.email
  ) {
    recipients.push({
      userId: attorneyData.id,
      email: attorneyData.email,
      name: attorneyData.first_name || 'Attorney',
    });
  }

  // Send emails to all recipients who have document_uploads enabled
  for (const recipient of recipients) {
    const shouldSend = await shouldSendEmail(recipient.userId, 'document_uploads');
    if (!shouldSend) continue;

    await sendEmail(
      {
        to: recipient.email,
        subject: `New Document: ${documentName}`,
        react: DocumentUploadedEmail({
          userName: recipient.name,
          caseTitle: caseData.title,
          documentName,
          documentType,
          uploadedBy: uploaderName,
          caseUrl,
        }),
      },
      recipient.userId,
      'document_uploaded',
      { caseId, documentName }
    );
  }
}

export async function sendDeadlineReminderEmail(
  userId: string,
  caseId: string,
  caseTitle: string,
  deadlineDate: Date,
  daysUntil: number
): Promise<void> {
  const shouldSend = await shouldSendEmail(userId, 'deadline_reminders');
  if (!shouldSend) return;

  const user = await getUserInfo(userId);
  if (!user) return;

  const caseUrl = `${APP_URL}/dashboard/cases/${caseId}`;
  const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await sendEmail(
    {
      to: user.email,
      subject: `Deadline Reminder: ${caseTitle} (${daysUntil} days)`,
      react: DeadlineReminderEmail({
        userName: user.firstName,
        caseTitle,
        deadline: formattedDeadline,
        daysUntil,
        caseUrl,
      }),
    },
    userId,
    'deadline_reminder',
    { caseId, daysUntil }
  );
}

export async function sendTeamInvitationEmail(
  inviteeEmail: string,
  inviterName: string,
  firmName: string,
  role: string,
  inviteToken: string,
  expiresAt?: Date
): Promise<void> {
  const invitationUrl = `${APP_URL}/invite/${inviteToken}`;
  const expiryDate = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
  const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await sendEmail(
    {
      to: inviteeEmail,
      subject: `You've been invited to join ${firmName} on CaseFill`,
      react: TeamInvitationEmail({
        inviterName,
        firmName,
        role,
        invitationUrl,
        expiresAt: formattedExpiry,
      }),
    },
    undefined,
    'team_invitation',
    { firmName, role }
  );
}

export async function sendBillingUpdateEmail(
  userId: string,
  eventType: Parameters<typeof BillingUpdateEmail>[0]['eventType'],
  details: {
    planName?: string;
    amount?: number;
    currency?: string;
    nextBillingDate?: string;
    trialEndDate?: string;
  }
): Promise<void> {
  const shouldSend = await shouldSendEmail(userId, 'billing_updates');
  if (!shouldSend) return;

  const user = await getUserInfo(userId);
  if (!user) return;

  const billingUrl = `${APP_URL}/dashboard/billing`;

  await sendEmail(
    {
      to: user.email,
      subject: getBillingEmailSubject(eventType, details.planName),
      react: BillingUpdateEmail({
        userName: user.firstName,
        eventType,
        billingUrl,
        ...details,
      }),
    },
    userId,
    'billing_update',
    { eventType }
  );
}

function getBillingEmailSubject(
  eventType: Parameters<typeof BillingUpdateEmail>[0]['eventType'],
  planName?: string
): string {
  switch (eventType) {
    case 'subscription_created':
      return `Welcome to ${planName || 'Pro'} - CaseFill`;
    case 'subscription_updated':
      return `Your subscription has been updated - CaseFill`;
    case 'subscription_cancelled':
      return `Your subscription has been cancelled - CaseFill`;
    case 'payment_succeeded':
      return `Payment received - CaseFill`;
    case 'payment_failed':
      return `Action required: Payment failed - CaseFill`;
    case 'trial_ending':
      return `Your trial is ending soon - CaseFill`;
    default:
      return `Billing update - CaseFill`;
  }
}
