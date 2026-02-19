'use client';

/**
 * Frontend job polling utility.
 *
 * Polls /api/jobs/[id]/status with exponential backoff until the job
 * completes or fails. Starts fast (1s) and slows down (up to 15s) to
 * reduce unnecessary requests on long-running jobs.
 */

import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import type { JobStatusResponse } from './types';

const INITIAL_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 15_000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1_000; // Stop after 5 minutes

export interface JobPollingCallbacks {
  onComplete?: (result: unknown) => void;
  onFailed?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

/**
 * Start polling a job's status until it completes or fails.
 *
 * Uses exponential backoff: 1s → 2s → 4s → 8s → 15s (cap).
 *
 * @returns A cleanup function that stops polling.
 */
export function startJobPolling(
  jobId: string,
  callbacks: JobPollingCallbacks = {}
): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let currentInterval = INITIAL_INTERVAL_MS;

  async function poll() {
    if (stopped) return;

    try {
      const response = await fetchWithTimeout(`/api/jobs/${jobId}/status`, {
        timeout: 'QUICK',
      });

      if (!response.ok) {
        stopped = true;
        callbacks.onFailed?.('Unable to check job status');
        return;
      }

      const json = (await response.json()) as { data?: JobStatusResponse } & JobStatusResponse;
      const status: JobStatusResponse = json.data ?? json;

      if (status.progress !== undefined) {
        callbacks.onProgress?.(status.progress);
        // Reset backoff when the job reports progress (actively working)
        currentInterval = INITIAL_INTERVAL_MS;
      }

      if (status.status === 'completed') {
        stopped = true;
        callbacks.onComplete?.(status.result);
        return;
      } else if (status.status === 'failed') {
        stopped = true;
        callbacks.onFailed?.(status.error || 'Processing failed. Please try again.');
        return;
      }
    } catch {
      // Network error — keep polling (transient failure)
    }

    // Schedule next poll with exponential backoff
    if (!stopped) {
      timeoutId = setTimeout(poll, currentInterval);
      currentInterval = Math.min(currentInterval * 2, MAX_INTERVAL_MS);
    }
  }

  // Start first poll after initial interval
  timeoutId = setTimeout(poll, currentInterval);

  // Auto-stop after max duration
  const maxTimeoutId = setTimeout(() => {
    if (!stopped) {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      callbacks.onFailed?.('Job timed out. Please check back later.');
    }
  }, MAX_POLL_DURATION_MS);

  // Return cleanup function
  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    clearTimeout(maxTimeoutId);
  };
}
