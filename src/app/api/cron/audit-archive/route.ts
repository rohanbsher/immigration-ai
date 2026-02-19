import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

const log = createLogger('cron:audit-archive');

/**
 * GET /api/cron/audit-archive
 *
 * Cron job endpoint that performs two-phase audit log maintenance:
 *
 * Phase 1 — Archive: Copy audit_log records older than 1 year to
 *   audit_log_archive via the archive_audit_log() DB function.
 *
 * Phase 2 — Cleanup: Delete audit_log records older than 7 years
 *   via the cleanup_audit_log() DB function (USCIS retention compliance).
 *
 * Runs weekly on Sunday at 3 AM UTC.
 *
 * Vercel Cron config (in vercel.json):
 * "crons": [{ "path": "/api/cron/audit-archive", "schedule": "0 3 * * 0" }]
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!features.cronJobs) {
      log.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const vercelCronHeader = request.headers.get('x-vercel-cron-secret');
    const expectedSecret = serverEnv.CRON_SECRET ?? '';
    const expectedAuth = `Bearer ${expectedSecret}`;

    const isAuthorized =
      (authHeader && safeCompare(authHeader, expectedAuth)) ||
      (vercelCronHeader && safeCompare(vercelCronHeader, expectedSecret));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    log.info('Starting audit log archive and cleanup');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient: any = getAdminClient();

    // Phase 1: Archive records older than 1 year
    const { data: archiveResult, error: archiveError } = await adminClient
      .rpc('archive_audit_log', { p_archive_after_years: 1, p_batch_size: 5000 });

    if (archiveError) {
      log.logError('Archive phase failed', archiveError);
      return NextResponse.json(
        { error: 'Archive phase failed', details: archiveError.message },
        { status: 500 }
      );
    }

    const archived = archiveResult ?? 0;
    log.info('Archive phase complete', { archived });

    // Phase 2: Cleanup records older than 7 years (USCIS retention)
    const { data: cleanupResult, error: cleanupError } = await adminClient
      .rpc('cleanup_audit_log', { p_retention_years: 7, p_batch_size: 10000 });

    if (cleanupError) {
      log.logError('Cleanup phase failed', cleanupError);
      // Archive succeeded, so return partial success
      return NextResponse.json({
        success: false,
        message: 'Archive succeeded but cleanup failed',
        archived,
        deleted: 0,
        cleanupError: cleanupError.message,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const deleted = cleanupResult ?? 0;

    // Also cleanup document_access_log (same retention policy)
    const { data: docLogResult, error: docLogError } = await adminClient
      .rpc('cleanup_document_access_log', { p_retention_years: 7, p_batch_size: 10000 });

    if (docLogError) {
      log.logError('Document access log cleanup failed', docLogError);
    }

    const docLogDeleted = docLogResult ?? 0;

    const summary = {
      archived,
      deleted,
      docLogDeleted,
    };

    log.info('Audit archive and cleanup complete', summary);

    return NextResponse.json({
      success: true,
      message: 'Audit archive and cleanup complete',
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.logError('Error during audit archive', error);

    return NextResponse.json(
      { error: 'Failed to run audit archive' },
      { status: 500 }
    );
  }
}
