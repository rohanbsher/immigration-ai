/**
 * Fetch wrapper with configurable timeouts.
 * Prevents hanging requests and provides consistent error handling.
 */

export const TIMEOUT_CONFIG = {
  /** 60 seconds for file uploads */
  UPLOAD: 60_000,
  /** 30 seconds for standard API calls */
  STANDARD: 30_000,
  /** 2 minutes for AI processing (autofill, document analysis) */
  AI: 120_000,
  /** 10 seconds for quick lookups (counts, status checks) */
  QUICK: 10_000,
} as const;

export type TimeoutType = keyof typeof TIMEOUT_CONFIG;

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout / 1000} seconds`);
    this.name = 'TimeoutError';
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds, or a named timeout type */
  timeout?: number | TimeoutType;
}

/**
 * Resolves a timeout value from either a number or a named timeout type.
 */
function resolveTimeout(timeout?: number | TimeoutType): number {
  if (timeout === undefined) {
    return TIMEOUT_CONFIG.STANDARD;
  }
  if (typeof timeout === 'number') {
    return timeout;
  }
  return TIMEOUT_CONFIG[timeout];
}

/**
 * Fetch wrapper with timeout support.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise<Response>
 * @throws TimeoutError if the request times out
 *
 * @example
 * // Standard request (30s timeout)
 * const response = await fetchWithTimeout('/api/cases');
 *
 * @example
 * // AI processing (2 min timeout)
 * const response = await fetchWithTimeout('/api/forms/123/autofill', {
 *   method: 'POST',
 *   timeout: 'AI',
 * });
 *
 * @example
 * // Custom timeout
 * const response = await fetchWithTimeout('/api/data', {
 *   timeout: 45000,
 * });
 */
export async function fetchWithTimeout(
  url: string,
  options?: FetchWithTimeoutOptions
): Promise<Response> {
  const timeout = resolveTimeout(options?.timeout);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Ensure cookies are sent with requests
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface UploadWithTimeoutOptions {
  /** Timeout in milliseconds (defaults to UPLOAD timeout) */
  timeout?: number;
  /** Progress callback for upload progress tracking */
  onProgress?: (progress: number) => void;
}

/**
 * Specialized fetch wrapper for file uploads.
 * Uses longer default timeout suitable for file transfers.
 *
 * @param url - The URL to upload to
 * @param formData - FormData containing the file(s)
 * @param options - Upload options
 * @returns Promise<Response>
 * @throws TimeoutError if the upload times out
 *
 * @example
 * const formData = new FormData();
 * formData.append('file', file);
 * const response = await uploadWithTimeout('/api/documents', formData);
 */
export async function uploadWithTimeout(
  url: string,
  formData: FormData,
  options?: UploadWithTimeoutOptions
): Promise<Response> {
  const timeout = options?.timeout ?? TIMEOUT_CONFIG.UPLOAD;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include', // Ensure cookies are sent with uploads
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Specialized fetch wrapper for AI processing requests.
 * Uses longer default timeout suitable for AI inference.
 *
 * @param url - The URL for AI processing
 * @param options - Fetch options (timeout defaults to AI)
 * @returns Promise<Response>
 * @throws TimeoutError if the request times out
 */
export async function fetchAI(
  url: string,
  options?: Omit<FetchWithTimeoutOptions, 'timeout'>
): Promise<Response> {
  return fetchWithTimeout(url, {
    ...options,
    timeout: TIMEOUT_CONFIG.AI,
  });
}
