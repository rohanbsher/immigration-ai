/**
 * URL validation utilities for SSRF prevention.
 *
 * These functions validate that URLs point to trusted internal resources,
 * preventing Server-Side Request Forgery (SSRF) attacks.
 */

/**
 * Default configuration for storage URL validation.
 */
export const STORAGE_URL_CONFIG = {
  /** Buckets that are allowed for document analysis */
  allowedBuckets: ['documents'] as readonly string[],
  /** Required path prefix for storage URLs */
  storagePath: '/storage/v1/object/',
} as const;

export interface ValidateStorageUrlOptions {
  /** Override the Supabase URL (useful for testing) */
  supabaseUrl?: string;
  /** Override the allowed buckets list */
  allowedBuckets?: readonly string[];
}

/**
 * Validates that a URL is from our trusted Supabase storage.
 * Prevents SSRF attacks by ensuring only internal storage URLs are processed.
 *
 * Checks performed:
 * 1. Origin validation (hostname + protocol must match Supabase URL)
 * 2. Protocol must be HTTPS
 * 3. Path must start with /storage/v1/object/
 * 4. No path traversal (.., //)
 * 5. Bucket must be in the allowlist
 *
 * @param urlString - The URL to validate
 * @param options - Optional configuration overrides
 * @returns true if the URL is valid and safe to fetch
 *
 * @example
 * ```typescript
 * // Basic usage
 * if (!validateStorageUrl(document.file_url)) {
 *   return new Response('Invalid URL', { status: 400 });
 * }
 *
 * // With custom options (for testing)
 * validateStorageUrl(url, {
 *   supabaseUrl: 'https://test.supabase.co',
 *   allowedBuckets: ['documents', 'avatars'],
 * });
 * ```
 */
export function validateStorageUrl(
  urlString: string,
  options: ValidateStorageUrlOptions = {}
): boolean {
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedBuckets = options.allowedBuckets ?? STORAGE_URL_CONFIG.allowedBuckets;

  if (!supabaseUrl) {
    return false;
  }

  try {
    const url = new URL(urlString);
    const expectedBaseUrl = new URL(supabaseUrl);

    // 1. Origin validation (hostname + protocol)
    if (url.origin !== expectedBaseUrl.origin) {
      return false;
    }

    // 2. Protocol must be HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // 3. Path must start with storage prefix
    if (!url.pathname.startsWith(STORAGE_URL_CONFIG.storagePath)) {
      return false;
    }

    // 4. No path traversal
    if (url.pathname.includes('..') || url.pathname.includes('//')) {
      return false;
    }

    // 5. Bucket allowlist
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path format: /storage/v1/object/public|authenticated/bucket/path...
    // After split and filter: ['storage', 'v1', 'object', 'public|authenticated', 'bucket', ...]
    if (pathParts.length < 5) {
      return false;
    }

    const bucket = pathParts[4];
    if (!allowedBuckets.includes(bucket)) {
      return false;
    }

    return true;
  } catch {
    // URL parsing failed - invalid URL
    return false;
  }
}
