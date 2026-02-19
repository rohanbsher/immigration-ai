/**
 * BullMQ queue instances for job submission.
 *
 * Used by Next.js API routes to enqueue jobs when WORKER_ENABLED=true.
 * Lazy-initialized to avoid connection attempts when worker is disabled.
 */

import { Queue, Job } from 'bullmq';
import { requireJobConnection } from './connection';
import {
  QUEUE_NAMES,
  AI_JOB_DEFAULTS,
  EMAIL_JOB_DEFAULTS,
  CRON_JOB_DEFAULTS,
  type DocumentAnalysisJob,
  type FormAutofillJob,
  type RecommendationsJob,
  type CompletenessJob,
  type SuccessScoreJob,
  type NaturalSearchJob,
  type EmailJob,
  type VirusScanJob,
  type CronJobPayload,
} from './types';

// Lazy-initialized queue instances
const queues = new Map<string, Queue>();

export function getOrCreateQueue<T>(name: string): Queue<T> {
  if (!queues.has(name)) {
    const connection = requireJobConnection();
    queues.set(name, new Queue<T>(name, { connection }));
  }
  return queues.get(name) as Queue<T>;
}

// =============================================================================
// AI Queues
// =============================================================================

export function getDocumentAnalysisQueue() {
  return getOrCreateQueue<DocumentAnalysisJob>(QUEUE_NAMES.DOCUMENT_ANALYSIS);
}

export function getFormAutofillQueue() {
  return getOrCreateQueue<FormAutofillJob>(QUEUE_NAMES.FORM_AUTOFILL);
}

export function getRecommendationsQueue() {
  return getOrCreateQueue<RecommendationsJob>(QUEUE_NAMES.RECOMMENDATIONS);
}

export function getCompletenessQueue() {
  return getOrCreateQueue<CompletenessJob>(QUEUE_NAMES.COMPLETENESS);
}

export function getSuccessScoreQueue() {
  return getOrCreateQueue<SuccessScoreJob>(QUEUE_NAMES.SUCCESS_SCORE);
}

export function getNaturalSearchQueue() {
  return getOrCreateQueue<NaturalSearchJob>(QUEUE_NAMES.NATURAL_SEARCH);
}

// =============================================================================
// Utility Queues
// =============================================================================

export function getEmailQueue() {
  return getOrCreateQueue<EmailJob>(QUEUE_NAMES.EMAIL);
}

export function getVirusScanQueue() {
  return getOrCreateQueue<VirusScanJob>(QUEUE_NAMES.VIRUS_SCAN);
}

// =============================================================================
// Cron Queue
// =============================================================================

export function getCronQueue() {
  return getOrCreateQueue<CronJobPayload>(QUEUE_NAMES.CRON);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Add a job with a deterministic ID, removing any stale completed/failed job first.
 * This preserves deduplication for active/waiting jobs while allowing re-enqueue after completion.
 */
async function addWithDedup(
  queue: Queue,
  name: string,
  data: unknown,
  opts: Record<string, unknown> & { jobId: string }
): Promise<Job> {
  const existingJob = await queue.getJob(opts.jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'completed' || state === 'failed') {
      await existingJob.remove();
    }
  }
  return queue.add(name, data, opts);
}

/**
 * Enqueue a document analysis job.
 */
export async function enqueueDocumentAnalysis(data: DocumentAnalysisJob) {
  const queue = getDocumentAnalysisQueue();
  return addWithDedup(queue, 'analyze', data, {
    ...AI_JOB_DEFAULTS,
    jobId: `doc-analysis:${data.documentId}`,
  });
}

/**
 * Enqueue a form autofill job.
 */
export async function enqueueFormAutofill(data: FormAutofillJob) {
  const queue = getFormAutofillQueue();
  return addWithDedup(queue, 'autofill', data, {
    ...AI_JOB_DEFAULTS,
    jobId: `form-autofill:${data.formId}`,
  });
}

/**
 * Enqueue an email job.
 */
export async function enqueueEmail(data: EmailJob) {
  const queue = getEmailQueue();
  return queue.add('send', data, EMAIL_JOB_DEFAULTS);
}

/**
 * Enqueue a recommendations job.
 */
export async function enqueueRecommendations(data: RecommendationsJob) {
  const queue = getRecommendationsQueue();
  return addWithDedup(queue, 'recommend', data, {
    ...AI_JOB_DEFAULTS,
    jobId: `recommendations:${data.caseId}`,
  });
}

/**
 * Enqueue a completeness analysis job.
 */
export async function enqueueCompleteness(data: CompletenessJob) {
  const queue = getCompletenessQueue();
  return addWithDedup(queue, 'analyze', data, {
    ...AI_JOB_DEFAULTS,
    jobId: `completeness:${data.caseId}`,
  });
}

/**
 * Enqueue a success score job.
 */
export async function enqueueSuccessScore(data: SuccessScoreJob) {
  const queue = getSuccessScoreQueue();
  return addWithDedup(queue, 'score', data, {
    ...AI_JOB_DEFAULTS,
    jobId: `success-score:${data.caseId}`,
  });
}

/**
 * Get all queue instances (for job status lookups).
 */
export function getAllQueues(): Queue[] {
  const names = Object.values(QUEUE_NAMES);
  return names.map((name) => {
    try {
      return getOrCreateQueue(name);
    } catch {
      return null;
    }
  }).filter(Boolean) as Queue[];
}

/**
 * Close all queue connections gracefully.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
}
