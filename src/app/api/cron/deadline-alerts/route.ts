import { NextRequest, NextResponse } from 'next/server';
import { syncDeadlineAlerts } from '@/lib/deadline';
import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';
import { safeCompare } from '@/lib/security/timing-safe';

const log = createLogger('cron:deadline-alerts');

/**
 * POST /api/cron/deadline-alerts
 *
 * Cron job endpoint to sync deadline alerts.
 * Should be called daily via Vercel Cron.
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
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`;

    // Always verify authorization with timing-safe comparison
    if (!authHeader || !safeCompare(authHeader, expectedAuth)) {
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

/**
 * GET /api/cron/deadline-alerts
 *
 * Health check endpoint for the cron job.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/cron/deadline-alerts',
    method: 'POST',
    schedule: '0 6 * * * (daily at 6 AM UTC)',
  });
}
