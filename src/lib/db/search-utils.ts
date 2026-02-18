/**
 * Pure utility functions for search input handling.
 *
 * Extracted from base-service.ts so modules that only need sanitization
 * don't pull in the Supabase server client (which depends on next/headers).
 */

/**
 * Sanitize search input to prevent PostgREST filter injection.
 * Escapes SQL LIKE wildcards and removes PostgREST special characters.
 */
export function sanitizeSearchInput(input: string): string {
  const truncated = input.slice(0, 100);
  const sanitized = truncated
    .replace(/[%_]/g, '\\$&')
    .replace(/[,.'"\(\)|]/g, '')
    .trim();
  return sanitized;
}
