/**
 * Sentry client-side configuration.
 * This file configures Sentry for the browser (client-side) environment.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for debugging user issues
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        // Mask all text content for privacy (immigration data is sensitive)
        maskAllText: true,
        // Block all media for privacy
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network errors that are often transient
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User-initiated aborts
      'AbortError',
      // Rate limit errors (expected behavior)
      'Too Many Requests',
    ],

    // Before sending, sanitize sensitive data
    beforeSend(event) {
      // Remove any PII from URLs
      if (event.request?.url) {
        event.request.url = sanitizeUrl(event.request.url);
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }

      // Mask user email partially for privacy
      if (event.user?.email) {
        event.user.email = maskEmail(event.user.email);
      }

      return event;
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Don't log fetch calls to health endpoint
      if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/api/health')) {
        return null;
      }
      return breadcrumb;
    },
  });
}

/**
 * Sanitize URLs by removing sensitive query parameters.
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove sensitive params
    const sensitiveParams = ['token', 'key', 'password', 'secret', 'auth'];
    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });
    return parsed.toString();
  } catch {
    return url;
  }
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
