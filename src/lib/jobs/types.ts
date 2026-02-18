/**
 * Shared job payload types used by both Next.js (enqueue) and Worker (process).
 */

// =============================================================================
// AI Job Payloads
// =============================================================================

export interface DocumentAnalysisJob {
  documentId: string;
  userId: string;
  caseId: string;
  documentType: string;
  storagePath: string; // Worker generates signed URL just-in-time
}

export interface FormAutofillJob {
  formId: string;
  userId: string;
  caseId: string;
  formType: string;
}

export interface RecommendationsJob {
  caseId: string;
  userId: string;
  visaType: string;
}

export interface CompletenessJob {
  caseId: string;
  userId: string;
}

export interface SuccessScoreJob {
  caseId: string;
  userId: string;
}

export interface NaturalSearchJob {
  query: string;
  userId: string;
  firmId: string;
}

// =============================================================================
// Utility Job Payloads
// =============================================================================

export interface EmailJob {
  to: string | string[];
  subject: string;
  templateName: string;
  templateData: Record<string, unknown>;
  emailLogId?: string;
  userId?: string;
  /** Pre-rendered HTML body (used by worker to avoid React dependency) */
  html?: string;
}

export interface VirusScanJob {
  documentId: string;
  userId: string;
  storagePath: string;
}

// =============================================================================
// Cron Job Payloads
// =============================================================================

export interface CronJobPayload {
  triggeredAt: string;
}

// =============================================================================
// Job Status (for polling)
// =============================================================================

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export interface JobStatusResponse {
  id: string;
  queueName: string;
  status: JobStatus;
  progress?: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
}

// =============================================================================
// Queue Names (single source of truth)
// =============================================================================

export const QUEUE_NAMES = {
  DOCUMENT_ANALYSIS: 'ai:document-analysis',
  FORM_AUTOFILL: 'ai:form-autofill',
  RECOMMENDATIONS: 'ai:recommendations',
  COMPLETENESS: 'ai:completeness',
  SUCCESS_SCORE: 'ai:success-score',
  NATURAL_SEARCH: 'ai:natural-search',
  EMAIL: 'util:email',
  VIRUS_SCAN: 'util:virus-scan',
  CRON: 'cron',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// =============================================================================
// Default Job Options
// =============================================================================

export const AI_JOB_DEFAULTS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
  timeout: 120_000, // 2 minutes — prevents worker starvation on hung AI calls
};

export const EMAIL_JOB_DEFAULTS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 5_000, // 5s, 10s, 20s, 40s, 80s
  },
  removeOnComplete: { age: 24 * 3600, count: 5000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
};

export const CRON_JOB_DEFAULTS = {
  attempts: 2,
  backoff: {
    type: 'fixed' as const,
    delay: 30_000,
  },
  removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
  removeOnFail: { age: 30 * 24 * 3600, count: 50 },
};
