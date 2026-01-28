/**
 * Sentry utilities for error tracking and monitoring.
 * Provides helpers for capturing errors, setting user context, and adding breadcrumbs.
 */

import * as Sentry from '@sentry/nextjs';

export interface UserContext {
  id: string;
  email?: string;
  role?: 'attorney' | 'client' | 'admin';
  firmId?: string;
}

/**
 * Set the current user context for error tracking.
 * Call this after user authentication.
 */
export function setUserContext(user: UserContext | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
      firm_id: user.firmId,
    } as Sentry.User);
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear user context on logout.
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add a breadcrumb for tracking user actions.
 */
export function addBreadcrumb(
  message: string,
  category: 'navigation' | 'user-action' | 'api' | 'form' | 'document' | 'ai',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Capture an exception with optional context.
 */
export function captureException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: Sentry.SeverityLevel;
  }
): string {
  return Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level,
  });
}

/**
 * Capture a message (for non-error events that need tracking).
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string {
  return Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Create a transaction for performance monitoring.
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Span | undefined {
  return Sentry.startInactiveSpan({
    name,
    op,
    forceTransaction: true,
  });
}

/**
 * Wrap an async function with error tracking.
 */
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  context: {
    operation: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): Promise<T> {
  const span = startTransaction(context.operation, 'function');

  try {
    const result = await fn();
    span?.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span?.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' }); // ERROR
    captureException(error, {
      tags: { operation: context.operation, ...context.tags },
      extra: context.extra,
    });
    throw error;
  } finally {
    span?.end();
  }
}

/**
 * Track API errors with context.
 */
export function captureApiError(
  error: unknown,
  endpoint: string,
  method: string,
  statusCode?: number
): string {
  return captureException(error, {
    tags: {
      type: 'api_error',
      endpoint,
      method,
      status_code: statusCode?.toString() ?? 'unknown',
    },
  });
}

/**
 * Track AI processing errors.
 */
export function captureAIError(
  error: unknown,
  operation: 'autofill' | 'analysis' | 'extraction' | 'validation',
  formType?: string,
  documentType?: string
): string {
  return captureException(error, {
    tags: {
      type: 'ai_error',
      operation,
      form_type: formType ?? 'unknown',
      document_type: documentType ?? 'unknown',
    },
    level: 'error',
  });
}

/**
 * Track form filing errors (high priority for immigration cases).
 */
export function captureFormFilingError(
  error: unknown,
  formId: string,
  formType: string,
  caseId: string
): string {
  return captureException(error, {
    tags: {
      type: 'form_filing_error',
      form_type: formType,
    },
    extra: {
      form_id: formId,
      case_id: caseId,
    },
    level: 'error',
  });
}

/**
 * Track document processing errors.
 */
export function captureDocumentError(
  error: unknown,
  operation: 'upload' | 'analysis' | 'verification' | 'download',
  documentType?: string
): string {
  return captureException(error, {
    tags: {
      type: 'document_error',
      operation,
      document_type: documentType ?? 'unknown',
    },
  });
}

/**
 * Sentry is configured and ready to use.
 */
export function isSentryEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
}

// Re-export commonly used Sentry functions
export { withScope, setTag, setExtra } from '@sentry/nextjs';
