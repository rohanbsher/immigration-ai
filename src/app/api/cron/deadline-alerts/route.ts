import { NextRequest, NextResponse } from 'next/server';
import { syncDeadlineAlerts } from '@/lib/deadline';

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
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require authorization
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret) {
        console.error('CRON_SECRET not configured');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] Starting deadline alerts sync...');

    // Sync all deadline alerts
    const syncCount = await syncDeadlineAlerts();

    console.log(`[Cron] Synced ${syncCount} deadline alerts`);

    return NextResponse.json({
      success: true,
      message: `Synced ${syncCount} deadline alerts`,
      syncCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error syncing deadline alerts:', error);

    return NextResponse.json(
      {
        error: 'Failed to sync deadline alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
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
