/**
 * Data retention cleanup jobs.
 *
 * These jobs handle automatic cleanup of expired data:
 * - AI-extracted data after 90 days
 * - Soft-deleted records after retention period
 * - Old audit logs (optional)
 *
 * Can be run as:
 * - A cron job (recommended for production)
 * - An API endpoint (for manual triggers)
 * - A serverless function
 */

import { createClient } from '@/lib/supabase/server';
import { auditService } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('jobs:cleanup');

export interface CleanupResult {
  success: boolean;
  documentsCleanedCount: number;
  softDeletesPurgedCount: number;
  errors: string[];
  timestamp: Date;
}

export interface CleanupOptions {
  /** Whether to actually perform deletions or just report what would be cleaned */
  dryRun?: boolean;
  /** How many days after soft delete to permanently purge records */
  softDeleteRetentionDays?: number;
  /** How many days to keep audit logs (optional, null = keep forever) */
  auditLogRetentionDays?: number | null;
}

const DEFAULT_OPTIONS: Required<CleanupOptions> = {
  dryRun: false,
  softDeleteRetentionDays: 365, // Keep soft-deleted records for 1 year
  auditLogRetentionDays: null, // Keep audit logs forever by default
};

/**
 * Clean up expired AI data from documents.
 * AI-extracted data is set to expire 90 days after analysis.
 */
async function cleanupExpiredAiData(
  dryRun: boolean
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    if (dryRun) {
      // Count records that would be affected
      const { count, error } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .not('ai_extracted_data', 'is', null)
        .lt('ai_data_expires_at', now);

      if (error) {
        errors.push(`Failed to count expired AI data: ${error.message}`);
        return { count: 0, errors };
      }

      return { count: count || 0, errors };
    }

    // Get IDs of documents to clean
    const { data: expiredDocs, error: selectError } = await supabase
      .from('documents')
      .select('id')
      .not('ai_extracted_data', 'is', null)
      .lt('ai_data_expires_at', now);

    if (selectError) {
      errors.push(`Failed to select expired documents: ${selectError.message}`);
      return { count: 0, errors };
    }

    if (!expiredDocs || expiredDocs.length === 0) {
      return { count: 0, errors };
    }

    // Clear AI data from expired documents
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        ai_extracted_data: null,
        ai_confidence_score: null,
        ai_data_expires_at: null,
      })
      .in('id', expiredDocs.map((d) => d.id));

    if (updateError) {
      errors.push(`Failed to clear AI data: ${updateError.message}`);
      return { count: 0, errors };
    }

    // Log the cleanup
    for (const doc of expiredDocs) {
      await auditService.log({
        table_name: 'documents',
        record_id: doc.id,
        operation: 'update',
        new_values: { ai_data_cleared: true, reason: 'data_retention_policy' },
      });
    }

    return { count: expiredDocs.length, errors };
  } catch (error) {
    errors.push(
      `Unexpected error in AI data cleanup: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return { count: 0, errors };
  }
}

/**
 * Permanently purge soft-deleted records after the retention period.
 */
async function purgeSoftDeletedRecords(
  retentionDays: number,
  dryRun: boolean
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let totalCount = 0;

  try {
    const supabase = await createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoff = cutoffDate.toISOString();

    const tables = ['cases', 'documents', 'forms'] as const;

    for (const table of tables) {
      if (dryRun) {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .not('deleted_at', 'is', null)
          .lt('deleted_at', cutoff);

        if (error) {
          errors.push(`Failed to count soft-deleted ${table}: ${error.message}`);
        } else {
          totalCount += count || 0;
        }
      } else {
        // Get records to purge
        const { data: recordsToPurge, error: selectError } = await supabase
          .from(table)
          .select('id')
          .not('deleted_at', 'is', null)
          .lt('deleted_at', cutoff);

        if (selectError) {
          errors.push(`Failed to select soft-deleted ${table}: ${selectError.message}`);
          continue;
        }

        if (!recordsToPurge || recordsToPurge.length === 0) {
          continue;
        }

        // Log before deletion
        for (const record of recordsToPurge) {
          await auditService.log({
            table_name: table as 'cases' | 'documents' | 'forms',
            record_id: record.id,
            operation: 'delete',
            additional_context: { reason: 'retention_policy_purge' },
          });
        }

        // Permanently delete
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .in('id', recordsToPurge.map((r) => r.id));

        if (deleteError) {
          errors.push(`Failed to purge soft-deleted ${table}: ${deleteError.message}`);
        } else {
          totalCount += recordsToPurge.length;
        }
      }
    }

    return { count: totalCount, errors };
  } catch (error) {
    errors.push(
      `Unexpected error in soft delete purge: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return { count: 0, errors };
  }
}

/**
 * Clean up old audit logs (optional).
 */
async function cleanupAuditLogs(
  retentionDays: number,
  dryRun: boolean
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    const supabase = await createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoff = cutoffDate.toISOString();

    if (dryRun) {
      const { count, error } = await supabase
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .lt('changed_at', cutoff);

      if (error) {
        errors.push(`Failed to count old audit logs: ${error.message}`);
        return { count: 0, errors };
      }

      return { count: count || 0, errors };
    }

    const { error: deleteError, count } = await supabase
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('changed_at', cutoff);

    if (deleteError) {
      errors.push(`Failed to delete old audit logs: ${deleteError.message}`);
      return { count: 0, errors };
    }

    return { count: count || 0, errors };
  } catch (error) {
    errors.push(
      `Unexpected error in audit log cleanup: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return { count: 0, errors };
  }
}

/**
 * Run all cleanup jobs.
 */
export async function runCleanupJobs(
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  let documentsCleanedCount = 0;
  let softDeletesPurgedCount = 0;

  log.info('Starting cleanup jobs', { dryRun: opts.dryRun });

  // 1. Clean up expired AI data
  log.info('Cleaning up expired AI data');
  const aiResult = await cleanupExpiredAiData(opts.dryRun);
  documentsCleanedCount = aiResult.count;
  errors.push(...aiResult.errors);
  log.info('AI data cleanup complete', { count: aiResult.count, dryRun: opts.dryRun });

  // 2. Purge soft-deleted records
  log.info('Purging soft-deleted records');
  const purgeResult = await purgeSoftDeletedRecords(
    opts.softDeleteRetentionDays,
    opts.dryRun
  );
  softDeletesPurgedCount = purgeResult.count;
  errors.push(...purgeResult.errors);
  log.info('Soft delete purge complete', { count: purgeResult.count, dryRun: opts.dryRun });

  // 3. Clean up old audit logs (if configured)
  if (opts.auditLogRetentionDays !== null) {
    log.info('Cleaning up old audit logs');
    const auditResult = await cleanupAuditLogs(
      opts.auditLogRetentionDays,
      opts.dryRun
    );
    errors.push(...auditResult.errors);
    log.info('Audit log cleanup complete', { count: auditResult.count, dryRun: opts.dryRun });
  }

  const success = errors.length === 0;

  if (!success) {
    log.error('Cleanup completed with errors', { errors });
  } else {
    log.info('Cleanup completed successfully');
  }

  return {
    success,
    documentsCleanedCount,
    softDeletesPurgedCount,
    errors,
    timestamp: new Date(),
  };
}

/**
 * Schedule cleanup jobs to run daily.
 * This is a simple in-memory scheduler - for production,
 * use a proper job scheduler like cron or a cloud scheduler.
 */
export function scheduleCleanupJobs(): void {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Run immediately on startup
  setTimeout(() => {
    runCleanupJobs().catch((err) => log.logError('Scheduled cleanup failed', err));
  }, 5000);

  // Then run daily
  setInterval(() => {
    runCleanupJobs().catch((err) => log.logError('Scheduled cleanup failed', err));
  }, ONE_DAY_MS);

  log.info('Cleanup jobs scheduled to run daily');
}
