/**
 * Timing-safe string comparison utilities.
 *
 * Uses Node.js crypto.timingSafeEqual to prevent timing attacks
 * when comparing secrets like API keys or tokens.
 */

import { timingSafeEqual } from 'crypto';

/**
 * Compare two strings in constant time to prevent timing attacks.
 *
 * Note: If strings have different lengths, this returns false immediately.
 * For most authentication scenarios, this is acceptable since an attacker
 * can determine string length anyway. If length-hiding is needed, consider
 * hashing both values first.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * const expectedToken = serverEnv.CRON_SECRET;
 * const providedToken = request.headers.get('authorization')?.replace('Bearer ', '');
 *
 * if (!providedToken || !safeCompare(providedToken, expectedToken)) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * ```
 */
export function safeCompare(a: string, b: string): boolean {
  // If lengths differ, we can't use timingSafeEqual directly
  // (it throws on length mismatch). We still return false in constant time
  // by comparing against a buffer of the same length.
  if (a.length !== b.length) {
    // Create a fake comparison to keep timing consistent
    const bufA = Buffer.from(a);
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Compare a provided value against an expected secret, handling null/undefined.
 *
 * @param provided - The user-provided value (may be null/undefined)
 * @param expected - The expected secret value (may be null/undefined)
 * @returns true if both are non-empty strings and match, false otherwise
 */
export function safeCompareSecrets(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) {
    return false;
  }
  return safeCompare(provided, expected);
}
