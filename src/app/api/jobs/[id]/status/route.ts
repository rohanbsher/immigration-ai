import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getJobConnection } from '@/lib/jobs/connection';
import { QUEUE_NAMES, type JobStatusResponse, type JobStatus } from '@/lib/jobs/types';
import { features } from '@/lib/config';

/**
 * GET /api/jobs/[id]/status
 *
 * Poll the status of a background job. Returns the job's current state,
 * progress, result (on completion), or error (on failure).
 *
 * Requires authentication. Users can only see their own jobs.
 */
export const GET = withAuth(
  async (_request, context, auth) => {
    if (!features.workerEnabled) {
      return errorResponse('Worker service is not enabled', 503);
    }

    const connection = getJobConnection();
    if (!connection) {
      return errorResponse('Job queue is not configured', 503);
    }

    const { id: jobId } = await context.params!;

    // Search all queues for the job
    const queueNames = Object.values(QUEUE_NAMES);
    let foundJob = null;
    let foundQueueName = '';

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, { connection });
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          // Verify the job belongs to this user
          const jobUserId = job.data?.userId;
          if (jobUserId && jobUserId !== auth.user.id) {
            await queue.close();
            return errorResponse('Job not found', 404);
          }

          foundJob = job;
          foundQueueName = queueName;
          await queue.close();
          break;
        }
        await queue.close();
      } catch {
        await queue.close();
      }
    }

    if (!foundJob) {
      return errorResponse('Job not found', 404);
    }

    const state = await foundJob.getState() as JobStatus;

    const response: JobStatusResponse = {
      id: foundJob.id!,
      queueName: foundQueueName,
      status: state,
      progress: typeof foundJob.progress === 'number' ? foundJob.progress : undefined,
      result: state === 'completed' ? foundJob.returnvalue : undefined,
      error: state === 'failed' ? foundJob.failedReason : undefined,
      createdAt: foundJob.timestamp,
      processedAt: foundJob.processedOn ?? undefined,
      completedAt: foundJob.finishedOn ?? undefined,
    };

    return successResponse(response);
  },
  { rateLimit: 'STANDARD' }
);
