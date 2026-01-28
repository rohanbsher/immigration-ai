/**
 * Sentry edge runtime configuration.
 * This file configures Sentry for edge functions and middleware.
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
    ],

    // Minimal beforeSend for edge performance
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      return event;
    },
  });
}
