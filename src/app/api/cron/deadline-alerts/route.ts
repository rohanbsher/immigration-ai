import { NextRequest, NextResponse } from 'next/server';
import { syncDeadlineAlerts } from '@/lib/deadline';
import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

const log = createLogger('cron:deadline-alerts');

/**
 * GET /api/cron/deadline-alerts
 *
 * Cron job endpoint to sync deadline alerts.
 * Called daily at 6 AM UTC via Vercel Cron.
 *
 * IMPORTANT: Vercel Cron sends GET requests, not POST.
 *
 * Vercel Cron config (in vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/deadline-alerts",
 *       "schedule": "0 6 * * *"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron jobs are properly configured
    if (!features.cronJobs) {
      log.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify cron secret (for security) - using timing-safe comparison
    // Supports both: Authorization: Bearer <secret> and x-vercel-cron-secret header
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

    log.info('Starting deadline alerts sync');

    // Sync all deadline alerts
    const syncCount = await syncDeadlineAlerts();

    log.info('Synced deadline alerts', { syncCount });

    return NextResponse.json({
      success: true,
      message: `Synced ${syncCount} deadline alerts`,
      syncCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.logError('Error syncing deadline alerts', error);

    return NextResponse.json(
      { error: 'Failed to sync deadline alerts' },
      { status: 500 }
    );
  }
}

