/**
 * Sentry context utilities.
 *
 * Provides helpers for setting user context and adding breadcrumbs
 * to Sentry events for better debugging.
 */

import * as Sentry from '@sentry/nextjs';
import type { UserRole } from '@/types';

interface SentryUserContext {
  id: string;
  email?: string;
  role?: UserRole;
  firmId?: string;
}

/**
 * Set the current user context in Sentry.
 * Call this when user logs in or profile is loaded.
 *
 * @param user - User information to set
 *
 * @example
 * // In auth provider or on profile load
 * setUserContext({
 *   id: profile.id,
 *   email: profile.email,
 *   role: profile.role,
 * });
 */
export function setUserContext(user: SentryUserContext | null): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  // Only send minimal PII - email is masked in beforeSend
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Add role as extra data for debugging
  });

  // Set role as a tag for filtering
  if (user.role) {
    Sentry.setTag('user.role', user.role);
  }

  // Set firm ID as a tag for multi-tenant debugging
  if (user.firmId) {
    Sentry.setTag('firm.id', user.firmId);
  }
}

/**
 * Clear user context from Sentry.
 * Call this when user logs out.
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
  Sentry.setTag('user.role', undefined);
  Sentry.setTag('firm.id', undefined);
}

type BreadcrumbCategory =
  | 'navigation'
  | 'action'
  | 'form'
  | 'api'
  | 'auth'
  | 'error';

/**
 * Add a breadcrumb to the Sentry trail.
 * Breadcrumbs help trace the user's journey leading up to an error.
 *
 * @param message - Description of the event
 * @param category - Category for grouping breadcrumbs
 * @param data - Additional data (will be sanitized by Sentry config)
 * @param level - Severity level
 *
 * @example
 * // Track form submission
 * addBreadcrumb('Submitted case creation form', 'form', {
 *   formType: 'new-case',
 *   visaType: 'I-130',
 * });
 */
export function addBreadcrumb(
  message: string,
  category: BreadcrumbCategory,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture an exception with additional context.
 * Use this for caught exceptions that you want to track.
 *
 * @param error - The error to capture
 * @param context - Additional context for debugging
 *
 * @example
 * try {
 *   await createCase(data);
 * } catch (error) {
 *   captureError(error, {
 *     action: 'createCase',
 *     caseData: { visaType: data.visa_type },
 *   });
 *   throw error;
 * }
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message (non-error event).
 * Use for important events that aren't errors.
 *
 * @param message - Message to capture
 * @param level - Severity level
 * @param context - Additional context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set a tag for the current scope.
 * Tags are indexed and searchable in Sentry.
 *
 * @param key - Tag key
 * @param value - Tag value
 */
export function setTag(key: string, value: string | undefined): void {
  Sentry.setTag(key, value);
}

/**
 * Set extra context data for the current scope.
 * Extra data is not indexed but helpful for debugging.
 *
 * @param key - Context key
 * @param value - Context value
 */
export function setExtra(key: string, value: unknown): void {
  Sentry.setExtra(key, value);
}

/**
 * Start a new Sentry transaction for performance monitoring.
 *
 * @param name - Transaction name
 * @param op - Operation type
 * @returns Transaction object
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}
