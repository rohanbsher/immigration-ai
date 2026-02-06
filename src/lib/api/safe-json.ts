/**
 * Safe JSON parsing utilities for API error responses.
 *
 * When a fetch response is not OK, the body may not be valid JSON
 * (e.g., HTML error pages from reverse proxies, 502 gateway errors).
 * These utilities prevent uncontrolled JSON parse errors from masking
 * the actual HTTP failure.
 */

/**
 * Safely parse a non-OK response body as JSON.
 * Returns a fallback error object if the body is not valid JSON.
 */
export async function safeParseErrorJson(
  response: Response
): Promise<{ error?: string; message?: string }> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
  } catch {
    // Response body is not valid JSON
  }
  return { error: response.statusText || `Request failed with status ${response.status}` };
}

/**
 * Extract a human-readable error message from a non-OK response.
 * Tries JSON parsing first, then falls back to status text.
 */
export async function getErrorMessage(response: Response): Promise<string> {
  const data = await safeParseErrorJson(response);
  return data.error || data.message || `Request failed with status ${response.status}`;
}
