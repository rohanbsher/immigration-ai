import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getAllQueues, getOrCreateQueue } from '@/lib/jobs/queues';
import { type JobStatusResponse, type JobStatus, QUEUE_NAMES } from '@/lib/jobs/types';
import { features } from '@/lib/config';

const JOB_ID_PREFIX_TO_QUEUE: Record<string, string> = {
  'recommendations': QUEUE_NAMES.RECOMMENDATIONS,
  'completeness': QUEUE_NAMES.COMPLETENESS,
  'success-score': QUEUE_NAMES.SUCCESS_SCORE,
  'doc-analysis': QUEUE_NAMES.DOCUMENT_ANALYSIS,
  'form-autofill': QUEUE_NAMES.FORM_AUTOFILL,
  'email': QUEUE_NAMES.EMAIL,
};

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

    // Try to resolve the queue from the deterministic jobId prefix (e.g. "recommendations--abc123")
    const prefix = jobId.split('--')[0];
    const targetQueueName = JOB_ID_PREFIX_TO_QUEUE[prefix];

    let foundJob = null;
    let foundQueueName = '';

    if (targetQueueName) {
      // Fast path: look up a single queue by prefix
      try {
        const queue = getOrCreateQueue(targetQueueName);
        const job = await queue.getJob(jobId);
        if (job) {
          const jobUserId = (job.data as Record<string, unknown>)?.userId;
          if (jobUserId && jobUserId !== auth.user.id) {
            return errorResponse('Job not found', 404);
          }
          if (!jobUserId) {
            return errorResponse('Job not found', 404);
          }
          foundJob = job;
          foundQueueName = queue.name;
        }
      } catch {
        // Fall through to all-queues search
      }
    }

    // Fallback: search all queues (for jobs without deterministic IDs like email)
    if (!foundJob) {
      let queues;
      try {
        queues = getAllQueues();
      } catch {
        return errorResponse('Job queue is not configured', 503);
      }

      if (queues.length === 0) {
        return errorResponse('Job queue is not configured', 503);
      }

      for (const queue of queues) {
        try {
          const job = await queue.getJob(jobId);
          if (job) {
            const jobUserId = (job.data as Record<string, unknown>)?.userId;
            if (jobUserId && jobUserId !== auth.user.id) {
              return errorResponse('Job not found', 404);
            }
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
    'status', 'processingTimeMs', 'warnings',
    // Completeness fields
    'overallCompleteness', 'filingReadiness', 'missingRequired', 'missingOptional',
    'uploadedDocs', 'recommendations', 'totalRequired', 'uploadedRequired', 'analyzedAt',
    // Recommendations fields
    'caseId', 'generatedAt', 'expiresAt', 'source', 'count',
    // Document analysis fields
    'documentType', 'extractedData', 'document', 'analysis',
    // Form autofill fields
    'fields', 'formType', 'formId', 'fieldsFilled', 'overallConfidence',
    'fieldsRequiringReview', 'missingDocuments',
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
