import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getAllQueues } from '@/lib/jobs/queues';
import { type JobStatusResponse, type JobStatus } from '@/lib/jobs/types';
import { features } from '@/lib/config';

/**
 * GET /api/jobs/[id]/status
 *
 * Poll the status of a background job. Returns the job's current state,
 * progress, result (on completion), or error (on failure).
 *
 * Uses singleton queue instances from queues.ts — no per-request Redis connections.
 * Requires authentication. Users can only see their own jobs.
 */
export const GET = withAuth(
  async (_request, context, auth) => {
    if (!features.workerEnabled) {
      return errorResponse('Worker service is not enabled', 503);
    }

    const { id: jobId } = await context.params!;

    // Use singleton queues — no new connections created
    let queues;
    try {
      queues = getAllQueues();
    } catch {
      return errorResponse('Job queue is not configured', 503);
    }

    if (queues.length === 0) {
      return errorResponse('Job queue is not configured', 503);
    }

    // Search all queues for the job
    let foundJob = null;
    let foundQueueName = '';

    for (const queue of queues) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          // Verify the job belongs to this user
          const jobUserId = job.data?.userId;
          if (jobUserId && jobUserId !== auth.user.id) {
            return errorResponse('Job not found', 404);
          }
          // If job has no userId, deny access (defensive)
          if (!jobUserId) {
            return errorResponse('Job not found', 404);
          }

          foundJob = job;
          foundQueueName = queue.name;
          break;
        }
      } catch {
        // Skip queues that fail (e.g., connection issues)
      }
    }

    if (!foundJob) {
      return errorResponse('Job not found', 404);
    }

    // getState() is called while the queue is still open (singleton, never closed per-request)
    const state = await foundJob.getState() as JobStatus;

    const response: JobStatusResponse = {
      id: foundJob.id!,
      queueName: foundQueueName,
      status: state,
      progress: typeof foundJob.progress === 'number' ? foundJob.progress : undefined,
      result: state === 'completed' ? sanitizeResult(foundJob.returnvalue) : undefined,
      error: state === 'failed' ? 'Job processing failed. Please try again.' : undefined,
      createdAt: foundJob.timestamp,
      processedAt: foundJob.processedOn ?? undefined,
      completedAt: foundJob.finishedOn ?? undefined,
    };

    return successResponse(response);
  },
  { rateLimit: 'STANDARD' }
);

/**
 * Sanitize job result before sending to the client.
 * Only pass through known safe fields; strip internal details.
 */
function sanitizeResult(returnvalue: unknown): unknown {
  if (!returnvalue || typeof returnvalue !== 'object') {
    return returnvalue;
  }

  const raw = returnvalue as Record<string, unknown>;

  // Whitelist fields that are safe for the frontend
  const SAFE_FIELDS = [
    // Common result fields
    'overallScore', 'confidence', 'factors', 'riskFactors', 'improvements', 'calculatedAt',
    // Completeness fields
    'overallCompleteness', 'filingReadiness', 'missingRequired', 'missingOptional',
    'uploadedDocs', 'recommendations', 'totalRequired', 'uploadedRequired', 'analyzedAt',
    // Recommendations fields
    'caseId', 'generatedAt', 'expiresAt', 'source',
    // Document analysis fields
    'documentType', 'extractedData',
    // Form autofill fields
    'fields', 'formType',
    // Degraded flag
    'degraded',
  ];

  const sanitized: Record<string, unknown> = {};
  for (const key of SAFE_FIELDS) {
    if (key in raw) {
      sanitized[key] = raw[key];
    }
  }

  return sanitized;
}
