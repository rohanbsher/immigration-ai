'use client';

/**
 * Frontend job polling utility.
 *
 * Polls /api/jobs/[id]/status at regular intervals until the job completes or fails.
 * Used by hooks to track background job progress after async submission.
 */

import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import type { JobStatusResponse } from './types';

const POLL_INTERVAL_MS = 3_000; // Poll every 3 seconds
const MAX_POLL_DURATION_MS = 5 * 60 * 1_000; // Stop after 5 minutes

export interface JobPollingCallbacks {
  onComplete?: (result: unknown) => void;
  onFailed?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

/**
 * Start polling a job's status until it completes or fails.
 *
 * @returns A cleanup function that stops polling.
 *
 * @example
 * ```typescript
 * const stop = startJobPolling('job-123', {
 *   onComplete: (result) => {
 *     queryClient.invalidateQueries({ queryKey: ['documents'] });
 *   },
 *   onFailed: (error) => {
 *     toast.error(error || 'Processing failed');
 *   },
 *   onProgress: (progress) => {
 *     setProgress(progress);
 *   },
 * });
 *
 * // To stop polling early:
 * stop();
 * ```
 */
export function startJobPolling(
  jobId: string,
  callbacks: JobPollingCallbacks = {}
): () => void {
  let stopped = false;

  const intervalId = setInterval(async () => {
    if (stopped) return;

    try {
      const response = await fetchWithTimeout(`/api/jobs/${jobId}/status`, {
        timeout: 'QUICK',
      });

      if (!response.ok) {
        // Job not found or server error — stop polling
        clearInterval(intervalId);
        stopped = true;
        callbacks.onFailed?.('Unable to check job status');
        return;
      }

      const json = (await response.json()) as { data?: JobStatusResponse } & JobStatusResponse;
      const status: JobStatusResponse = json.data ?? json;

      if (status.progress !== undefined) {
        callbacks.onProgress?.(status.progress);
      }

      if (status.status === 'completed') {
        clearInterval(intervalId);
        stopped = true;
        callbacks.onComplete?.(status.result);
      } else if (status.status === 'failed') {
        clearInterval(intervalId);
        stopped = true;
        callbacks.onFailed?.(status.error || 'Processing failed. Please try again.');
      }
    } catch {
      // Network error — keep polling (transient failure)
    }
  }, POLL_INTERVAL_MS);

  // Auto-stop after max duration
  const timeoutId = setTimeout(() => {
    if (!stopped) {
      clearInterval(intervalId);
      stopped = true;
      callbacks.onFailed?.('Job timed out. Please check back later.');
    }
  }, MAX_POLL_DURATION_MS);

  // Return cleanup function
  return () => {
    stopped = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };
}
