/**
 * Sentry edge runtime configuration.
 * This file configures Sentry for edge functions and middleware.
 *
 * Mirrors the PII scrubbing from sentry.server.config.ts to ensure
 * no sensitive data (SSNs, passport numbers, API keys) leaks to Sentry.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Lower sample rate for edge (high volume)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.5,

    // Filter out noisy errors
    ignoreErrors: [
      'Too Many Requests',
      'ECONNRESET',
      'ECONNREFUSED',
    ],

    // PII scrubbing — mirrors sentry.server.config.ts
    beforeSend(event) {
      // Sanitize error messages to remove secrets/PII
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((exception) => {
          if (exception.value) {
            exception.value = sanitizeErrorMessage(exception.value);
          }
          return exception;
        });
      }

      // Remove sensitive request data
      if (event.request?.data) {
        event.request.data = '[REDACTED]';
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
        delete event.request.headers['X-API-Key'];
      }

      // Mask user info
      if (event.user?.email) {
        event.user.email = maskEmail(event.user.email);
      }

      return event;
    },
  });
}

/**
 * Sanitize error messages by removing potential secrets.
 */
function sanitizeErrorMessage(message: string): string {
  const patterns = [
    // API keys
    /sk_[a-zA-Z0-9]+/g,    // Stripe secret keys
    /re_[a-zA-Z0-9]+/g,    // Resend API keys
    /pk_[a-zA-Z0-9]+/g,    // Stripe publishable keys
    // Generic patterns
    /Bearer [a-zA-Z0-9._-]+/g,
    /token=[a-zA-Z0-9._-]+/gi,
    /key=[a-zA-Z0-9._-]+/gi,
    /password=[^\s&]+/gi,
    // SSN patterns
    /\d{3}-\d{2}-\d{4}/g,
    // Passport numbers
    /[A-Z]{1,2}\d{6,9}/g,
    // USCIS A-numbers
    /A\d{8,9}/g,
    // Receipt numbers
    /[A-Z]{3}\d{10,13}/g,
  ];

  let sanitized = message;
  patterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Mask email addresses for privacy.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[REDACTED]';
  const maskedLocal = local.charAt(0) + '***' + (local.length > 1 ? local.charAt(local.length - 1) : '');
  return `${maskedLocal}@${domain}`;
}
