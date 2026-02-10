/**
 * Sentry client-side configuration.
 * This file configures Sentry for the browser (client-side) environment.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const CONSENT_KEY = 'immigration-ai-consent';

function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

if (SENTRY_DSN) {
  const analyticsAllowed = hasAnalyticsConsent();

  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment configuration
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay only when user consented
    replaysSessionSampleRate: analyticsAllowed ? 0.1 : 0,
    replaysOnErrorSampleRate: analyticsAllowed ? 1.0 : 0,

    // Integrations -- replay only included when user has consented
    integrations: analyticsAllowed
      ? [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ]
      : [Sentry.browserTracingIntegration()],

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
