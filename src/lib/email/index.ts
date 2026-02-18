import { resend, EMAIL_CONFIG } from './client';
import { createClient } from '@/lib/supabase/server';
import type { ReactElement } from 'react';
import { createLogger } from '@/lib/logger';
import { features } from '@/lib/config';
import { enqueueEmail } from '@/lib/jobs/queues';

const log = createLogger('email');

export { EMAIL_CONFIG } from './client';

export type EmailType =
  | 'welcome'
  | 'password_reset'
  | 'case_update'
  | 'deadline_reminder'
  | 'document_uploaded'
  | 'form_update'
  | 'team_invitation'
  | 'billing_update';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  react?: ReactElement;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
  userId?: string,
  templateName?: string,
  templateData?: Record<string, unknown>
): Promise<SendEmailResult> {
  const supabase = await createClient();

  const emailLogData = {
    user_id: userId || null,
    email_to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    email_from: EMAIL_CONFIG.from,
    subject: options.subject,
    template_name: templateName || null,
    template_data: templateData || {},
    status: 'pending' as const,
  };

  const { data: emailLog, error: logError } = await supabase
    .from('email_log')
    .insert(emailLogData)
    .select()
    .single();

  if (logError) {
    log.logError('Failed to create email log', logError);
  }

  // Async path: enqueue email job when worker is enabled
  if (features.workerEnabled) {
    try {
      // Pre-render React template to HTML if needed
      let htmlBody = options.html;
      if (!htmlBody && options.react) {
        const { renderToStaticMarkup } = await import('react-dom/server');
        htmlBody = renderToStaticMarkup(options.react);
      }

      if (!htmlBody && options.text) {
        htmlBody = `<pre>${options.text}</pre>`;
      }

      if (!htmlBody) {
        log.warn('Email enqueue skipped: no HTML or React template provided');
        return { success: false, error: 'No email body to send' };
      }

      await enqueueEmail({
        to: options.to,
        subject: options.subject,
        templateName: templateName || 'unknown',
        templateData: templateData || {},
        emailLogId: emailLog?.id,
        userId: userId,
        html: htmlBody,
      });

      return {
        success: true,
        messageId: `queued-${emailLog?.id || 'unknown'}`,
      };
    } catch (err) {
      log.logError('Failed to enqueue email job', err);
      // Fall through to synchronous send
    }
  }

  if (!resend) {
    log.warn('Email not sent: Resend is not configured');
    if (emailLog) {
      await supabase
        .from('email_log')
        .update({
          status: 'failed',
          error_message: 'Resend is not configured',
        })
        .eq('id', emailLog.id);
    }
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      react: options.react,
      text: options.text,
      replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      tags: options.tags,
    });

    if (error) {
      log.logError('Resend error', error);
      if (emailLog) {
        await supabase
          .from('email_log')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', emailLog.id);
      }
      return {
        success: false,
        error: error.message,
      };
    }

    if (emailLog && data?.id) {
      await supabase
        .from('email_log')
        .update({
          status: 'sent',
          resend_id: data.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', emailLog.id);
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    log.logError('Email send error', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (emailLog) {
      await supabase
        .from('email_log')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', emailLog.id);
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function shouldSendEmail(
  userId: string,
  emailType: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase.rpc('should_send_email', {
    p_user_id: userId,
    p_email_type: emailType,
  });

  return data === true;
}

export async function getNotificationPreferences(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_or_create_notification_preferences', {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to get notification preferences: ${error.message}`);
  }

  return data;
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<{
    email_enabled: boolean;
    email_case_updates: boolean;
    email_deadline_reminders: boolean;
    email_document_uploads: boolean;
    email_form_updates: boolean;
    email_team_updates: boolean;
    email_billing_updates: boolean;
    email_marketing: boolean;
    deadline_reminder_days: number[];
    timezone: string;
  }>
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
    }, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update notification preferences: ${error.message}`);
  }

  return data;
}
