/**
 * Shared API response parser for frontend hooks.
 *
 * The backend uses two response formats:
 * 1. Envelope format: { success: true, data: { ... } } via successResponse()
 * 2. Raw format: { ... } returned directly via NextResponse.json()
 *
 * Error responses may be:
 * - Envelope: { success: false, error: "..." }
 * - Raw: { error: "..." } or { message: "..." }
 * - Non-JSON (HTML error pages from proxies, 502s, etc.)
 *
 * This parser handles all formats consistently, so individual hooks
 * do not need to know which format their API route uses.
 */

import { safeParseErrorJson } from '@/lib/api/safe-json';

/**
 * Parse an API response, handling both envelope and raw formats.
 *
 * - If `response.ok` is false, extracts an error message and throws.
 * - If the body is `{ success: true, data: T }`, returns `data`.
 * - If the body is `{ success: false, error: "..." }`, throws.
 * - Otherwise, returns the raw parsed JSON as T.
 *
 * @typeParam T - The expected shape of the response data
 * @param response - The fetch Response object
 * @returns The parsed data of type T
 * @throws Error with a human-readable message on failure
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout('/api/cases', { method: 'POST', body: ... });
 * return parseApiResponse<Case>(response);
 * ```
 */
export async function parseApiResponse<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await safeParseErrorJson(response);
    const message = body.error || body.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const json = await response.json();

  // Handle envelope format from successResponse() / errorResponse()
  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      throw new Error(json.error || 'Request failed');
    }
    return (json.data ?? json) as T;
  }

  return json as T;
}

/**
 * Parse an API response that returns no meaningful body (e.g. DELETE operations).
 *
 * Only checks for errors -- does not attempt to parse a response body on success.
 *
 * @param response - The fetch Response object
 * @throws Error with a human-readable message on failure
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout(`/api/cases/${id}`, { method: 'DELETE' });
 * await parseApiVoidResponse(response);
 * ```
 */
export async function parseApiVoidResponse(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await safeParseErrorJson(response);
    const message = body.error || body.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
}
