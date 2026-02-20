/**
 * Email client for sending transactional emails via Resend.
 *
 * Uses lazy initialization to avoid errors during build/client import.
 * All server-only values are accessed through getters, not at module load.
 */

import { Resend } from 'resend';
import { serverEnv, env, features } from '@/lib/config';

let resendInstance: Resend | null | undefined;

/**
 * Get the Resend email client (lazy singleton).
 * Returns null if email is not configured.
 */
export function getResendClient(): Resend | null {
  if (resendInstance === undefined) {
    resendInstance = features.email
      ? new Resend(serverEnv.RESEND_API_KEY)
      : null;
  }
  return resendInstance;
}

/**
 * Resend client proxy - throws helpful error if email not configured.
 */
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const client = getResendClient();
    if (!client) {
      throw new Error('Email is not configured. Set RESEND_API_KEY.');
    }
    return client[prop as keyof Resend];
  },
});

/**
 * Email configuration - uses getters to avoid server env access at module load.
 */
export const EMAIL_CONFIG = {
  /** Sender address for outgoing emails (server-only) */
  get from() {
    return serverEnv.EMAIL_FROM || 'CaseFill <noreply@casefill.ai>';
  },
  /** Reply-to address (server-only) */
  get replyTo() {
    return serverEnv.EMAIL_REPLY_TO || 'support@casefill.ai';
  },
  /** Application name for email templates */
  appName: 'CaseFill',
  /** Application URL for links in emails */
  get appUrl() {
    return env.NEXT_PUBLIC_APP_URL || 'https://casefill.ai';
  },
} as const;
