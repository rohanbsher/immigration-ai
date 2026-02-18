/**
 * Email Worker Processor
 *
 * Sends pre-rendered HTML emails via Resend SDK.
 * Receives job payload with { to, subject, html, emailLogId }.
 * Updates email_log status on success/failure.
 */

import { Job } from 'bullmq';
import { Resend } from 'resend';
import type { EmailJob } from '@/lib/jobs/types';
import { getWorkerSupabase } from '../supabase';
import { workerConfig } from '../config';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!workerConfig.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(workerConfig.RESEND_API_KEY);
  }
  return resendClient;
}

export async function processEmail(
  job: Job<EmailJob>
): Promise<{ success: boolean; messageId?: string }> {
  const { to, subject, html, emailLogId } = job.data;
  const supabase = getWorkerSupabase();

  await job.updateProgress(10);

  if (!html) {
    throw new Error('Email job missing pre-rendered HTML body');
  }

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: 'Immigration AI <noreply@immigrationai.app>',
      to,
      subject,
      html,
    });

    await job.updateProgress(80);

    if (error) {
      // Update email log as failed
      if (emailLogId) {
        await supabase
          .from('email_log')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', emailLogId);
      }
      throw new Error(`Resend error: ${error.message}`);
    }

    // Update email log as sent
    if (emailLogId && data?.id) {
      await supabase
        .from('email_log')
        .update({
          status: 'sent',
          resend_id: data.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', emailLogId);
    }

    await job.updateProgress(100);

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    // Update email log as failed if not already handled
    if (emailLogId && !(err instanceof Error && err.message.startsWith('Resend error:'))) {
      await supabase
        .from('email_log')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', emailLogId);
    }
    throw err;
  }
}
