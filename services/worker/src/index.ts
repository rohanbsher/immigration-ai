import 'dotenv/config';
import * as Sentry from '@sentry/node';

import { workerConfig } from './config';
import { startHealthServer } from './health';
import { requireJobConnection } from '@/lib/jobs/connection';
import { QUEUE_NAMES } from '@/lib/jobs/types';
import { Queue, Worker } from 'bullmq';

// Allowlist: only keep non-PII fields safe for DLQ storage and Sentry reporting.
// Any new job fields default to being excluded -- must be explicitly added here.
const DLQ_SAFE_FIELDS = [
  'requestId', 'documentId', 'caseId', 'documentType', 'storagePath',
  'formId', 'formType', 'visaType', 'userId', 'subject', 'templateName',
  'emailLogId',
] as const;

// Regex patterns for PII that could leak into error messages
const PII_SCRUB_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { pattern: /\bA\d{8,9}\b/gi, replacement: '[A-NUM]' },
  { pattern: /\b[A-Z]{1,2}\d{6,8}\b/g, replacement: '[PASSPORT]' },
  { pattern: /\b(?:EAC|WAC|LIN|SRC|MSC|IOE)\d{10}\b/gi, replacement: '[RECEIPT#]' },
];

function scrubPiiFromString(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_SCRUB_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function filterJobData(raw: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of DLQ_SAFE_FIELDS) {
    if (key in raw) safe[key] = raw[key];
  }
  return safe;
}

// Processors
import { processDocumentAnalysis } from './processors/document-analysis';
import { processFormAutofill } from './processors/form-autofill';
import { processRecommendations } from './processors/recommendations';
import { processCompleteness } from './processors/completeness';
import { processSuccessScore } from './processors/success-score';
import { processEmail } from './processors/email';

// =============================================================================
// Startup banner
// =============================================================================

function printBanner(): void {
  console.log('');
  console.log('='.repeat(60));
  console.log('  CaseFill - Worker Service v0.1.0');
  console.log('='.repeat(60));
  console.log(`  Environment:  ${workerConfig.NODE_ENV}`);
  console.log(`  Port:         ${workerConfig.PORT}`);
  console.log(`  Concurrency:  ${workerConfig.WORKER_CONCURRENCY}`);
  console.log(`  AI (OpenAI):  ${workerConfig.OPENAI_API_KEY ? 'configured' : 'not set'}`);
  console.log(`  AI (Claude):  ${workerConfig.ANTHROPIC_API_KEY ? 'configured' : 'not set'}`);
  console.log(`  Email:        ${workerConfig.RESEND_API_KEY ? 'configured' : 'not set'}`);
  console.log(`  Sentry:       ${workerConfig.SENTRY_DSN ? 'configured' : 'not set'}`);
  console.log('='.repeat(60));
  console.log('');
}

// =============================================================================
// Graceful shutdown
// =============================================================================

let isShuttingDown = false;
const cleanupCallbacks: Array<() => Promise<void>> = [];

function registerCleanup(fn: () => Promise<void>): void {
  cleanupCallbacks.push(fn);
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  for (const fn of cleanupCallbacks) {
    try {
      await fn();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  console.log('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  // Initialize Sentry if configured
  if (workerConfig.SENTRY_DSN) {
    Sentry.init({
      dsn: workerConfig.SENTRY_DSN,
      environment: workerConfig.NODE_ENV,
      tracesSampleRate: workerConfig.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        // Scrub PII patterns from exception messages
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) {
              ex.value = scrubPiiFromString(ex.value);
            }
          }
        }
        // Scrub PII from message
        if (event.message) {
          event.message = scrubPiiFromString(event.message);
        }
        // Filter jobData in extras through safe fields allowlist
        if (event.extra?.jobData && typeof event.extra.jobData === 'object') {
          event.extra.jobData = filterJobData(
            event.extra.jobData as Record<string, unknown>
          );
        }
        return event;
      },
    });
    console.log('Sentry initialized.');
  }

  printBanner();

  // Validate Redis connection
  const connection = requireJobConnection();
  console.log('Redis connection configured.');

  // Create Queue instances for health reporting and Bull Board.
  // These are read-only queue handles (no workers attached yet).
  const queueNames = Object.values(QUEUE_NAMES);
  const queues = queueNames.map(
    (name) => new Queue(name, { connection })
  );

  // DLQ queue — exhausted jobs are forwarded here for manual inspection/replay
  const dlqQueue = new Queue(QUEUE_NAMES.DLQ, { connection });

  // Register queue cleanup on shutdown
  registerCleanup(async () => {
    console.log('Closing queue connections...');
    await Promise.all([...queues, dlqQueue].map((q) => q.close()));
    console.log('Queue connections closed.');
  });

  // Start health/admin server (include DLQ in queue list for dashboard visibility)
  startHealthServer([...queues, dlqQueue]);

  // Register BullMQ workers for each AI queue
  const concurrency = workerConfig.WORKER_CONCURRENCY;
  const workers: Worker[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerDefs: Array<{ name: string; processor: (job: any) => Promise<any> }> = [
    { name: QUEUE_NAMES.DOCUMENT_ANALYSIS, processor: processDocumentAnalysis },
    { name: QUEUE_NAMES.FORM_AUTOFILL, processor: processFormAutofill },
    { name: QUEUE_NAMES.RECOMMENDATIONS, processor: processRecommendations },
    { name: QUEUE_NAMES.COMPLETENESS, processor: processCompleteness },
    { name: QUEUE_NAMES.SUCCESS_SCORE, processor: processSuccessScore },
    { name: QUEUE_NAMES.EMAIL, processor: processEmail },
  ];

  // Lock/stalled settings: AI jobs can take up to 2 minutes (job timeout),
  // so lockDuration must exceed that to prevent BullMQ from marking them stalled.
  const AI_WORKER_OPTS = {
    lockDuration: 150_000, // 2.5 min (exceeds 2-min job timeout)
    stalledInterval: 120_000,
    maxStalledCount: 1,
  };
  const EMAIL_WORKER_OPTS = {
    lockDuration: 30_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  };

  for (const def of workerDefs) {
    const isEmail = def.name === QUEUE_NAMES.EMAIL;
    const worker = new Worker(def.name, def.processor, {
      connection,
      concurrency,
      ...(isEmail ? EMAIL_WORKER_OPTS : AI_WORKER_OPTS),
    });

    worker.on('completed', (job) => {
      const reqId = job.data?.requestId;
      console.log(`[${def.name}] Job ${job.id} completed${reqId ? ` (requestId: ${reqId})` : ''}`);
    });

    worker.on('failed', (job, err) => {
      const reqId = job?.data?.requestId;
      console.error(`[${def.name}] Job ${job?.id} failed${reqId ? ` (requestId: ${reqId})` : ''}:`, scrubPiiFromString(err.message));
      const safeJobData = filterJobData((job?.data ?? {}) as Record<string, unknown>);
      Sentry.captureException(err, {
        tags: { queue: def.name, jobId: job?.id, requestId: reqId },
        extra: { jobData: safeJobData },
      });

      // Forward exhausted jobs (all retries spent) to DLQ for manual inspection
      const maxAttempts = job?.opts?.attempts ?? 1;
      if (job && job.attemptsMade >= maxAttempts) {
        const safeData = filterJobData((job.data ?? {}) as Record<string, unknown>);

        dlqQueue.add('failed', {
          originalQueue: def.name,
          originalJobId: job.id,
          data: safeData,
          error: scrubPiiFromString(err.message),
          failedAt: new Date().toISOString(),
          attemptsMade: job.attemptsMade,
        }, {
          removeOnComplete: { age: 30 * 24 * 3600 },  // 30 days
          removeOnFail: { age: 30 * 24 * 3600 },
        }).catch((dlqErr) => {
          console.error(`[DLQ] Failed to enqueue exhausted job ${job.id}:`, dlqErr);
        });
      }
    });

    workers.push(worker);
    console.log(`  Worker registered: ${def.name} (concurrency: ${concurrency})`);
  }

  // Register worker cleanup on shutdown
  registerCleanup(async () => {
    console.log('Closing workers...');
    await Promise.all(workers.map((w) => w.close()));
    console.log('Workers closed.');
  });

  console.log(`\nWorker service started. ${workers.length} workers active.`);
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
