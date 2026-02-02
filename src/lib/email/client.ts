import { Resend } from 'resend';
import { createLogger } from '@/lib/logger';

const log = createLogger('email-client');

if (!process.env.RESEND_API_KEY) {
  log.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'Immigration AI <noreply@immigrationai.app>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@immigrationai.app',
  appName: 'Immigration AI',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://immigrationai.app',
} as const;
