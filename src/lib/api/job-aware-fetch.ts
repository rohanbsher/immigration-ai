'use client';

/**
 * Job-aware fetch helper for async API responses.
 *
 * When the backend returns HTTP 202 with a `jobId`, this helper
 * polls the job status endpoint until the job completes or fails,
 * then resolves with the final result or throws on failure.
 *
 * When the backend returns 200 (synchronous mode), it passes through
 * to the normal response parser.
 */

import { fetchWithTimeout, type FetchWithTimeoutOptions } from './fetch-with-timeout';
import type { JobStatusResponse } from '@/lib/jobs/types';
import { safeParseErrorJson } from './safe-json';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1_000;

interface AsyncJobResponse {
  jobId: string;
  status: 'queued';
  message?: string;
}

function isAsyncJobResponse(data: unknown): data is AsyncJobResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'jobId' in data &&
    'status' in data &&
    (data as AsyncJobResponse).status === 'queued'
  );
}

/**
 * Poll a job until it completes, then return the result.
 */
async function pollUntilComplete(
  jobId: string,
  onProgress?: (progress: number) => void
): Promise<unknown> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetchWithTimeout(`/api/jobs/${jobId}/status`, {
      timeout: 'QUICK',
    });

    if (!response.ok) {
      throw new Error('Unable to check job status');
    }

    const json = await response.json();
    const status: JobStatusResponse = json.data ?? json;

    if (status.progress !== undefined) {
      onProgress?.(status.progress);
    }

    if (status.status === 'completed') {
      return status.result;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Processing failed. Please try again.');
    }
  }

  throw new Error('Job timed out. Please check back later.');
}

/**
 * Fetch an API endpoint that may return 202 (async job) or 200 (sync result).
 *
 * - For 200: parses and returns the response normally.
 * - For 202: polls the job status endpoint until completion, then returns the result.
 * - For errors: throws with a human-readable message.
 *
 * @param url - The API endpoint URL
 * @param init - Fetch options (method, headers, body, etc.)
 * @param onProgress - Optional callback for job progress updates
 */
export async function fetchJobAware<T = unknown>(
  url: string,
  init?: FetchWithTimeoutOptions,
  onProgress?: (progress: number) => void
): Promise<T> {
  const response = await fetchWithTimeout(url, init);

  if (!response.ok && response.status !== 202) {
    const body = await safeParseErrorJson(response);
    const message = body.error || body.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const json = await response.json();

  // Check if this is an async job response (202)
  if (response.status === 202 && isAsyncJobResponse(json)) {
    const result = await pollUntilComplete(json.jobId, onProgress);
    return result as T;
  }

  // Check if this is an async response in an envelope
  if (response.status === 202 && json?.data && isAsyncJobResponse(json.data)) {
    const result = await pollUntilComplete(json.data.jobId, onProgress);
    return result as T;
  }

  // Standard synchronous response — use same logic as parseApiResponse
  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      throw new Error(json.error || 'Request failed');
    }
    return (json.data ?? json) as T;
  }

  return json as T;
}
