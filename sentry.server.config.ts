/**
 * Sentry server-side configuration.
 * This file configures Sentry for the Node.js server environment.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance monitoring (lower rate for server to manage costs)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

    // Spotlight for development
    spotlight: process.env.NODE_ENV === 'development',

    // Filter out noisy errors
    ignoreErrors: [
      // Rate limit errors (expected behavior)
      'Too Many Requests',
      // Network errors from clients
      'ECONNRESET',
      'ECONNREFUSED',
    ],

    // Before sending, sanitize sensitive data
    beforeSend(event) {
      // Remove any sensitive data from error messages
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
  // Patterns that might contain secrets
  const patterns = [
    // API keys
    /sk_[a-zA-Z0-9]+/g, // Stripe secret keys
    /re_[a-zA-Z0-9]+/g, // Resend API keys
    /pk_[a-zA-Z0-9]+/g, // Stripe publishable keys
    // Generic patterns
    /Bearer [a-zA-Z0-9._-]+/g,
    /token=[a-zA-Z0-9._-]+/gi,
    /key=[a-zA-Z0-9._-]+/gi,
    /password=[^\s&]+/gi,
    // SSN patterns
    /\d{3}-\d{2}-\d{4}/g,
    // Passport numbers
    /[A-Z]{1,2}\d{6,9}/g,
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
