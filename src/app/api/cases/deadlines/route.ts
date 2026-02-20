import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { getUpcomingDeadlines } from '@/lib/deadline';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:deadlines');

/**
 * GET /api/cases/deadlines
 *
 * Get upcoming deadlines for the authenticated user.
 *
 * Query params:
 * - days: Number of days to look ahead (default 60)
 */
export const GET = withAuth(async (request, _context, auth) => {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '60', 10);
    const validDays = Math.min(Math.max(days, 1), 365);

    const deadlines = await getUpcomingDeadlines(auth.user.id, validDays);

    // Group by severity
    const critical = deadlines.filter((d) => d.severity === 'critical' && !d.acknowledged);
    const warning = deadlines.filter((d) => d.severity === 'warning' && !d.acknowledged);
    const info = deadlines.filter((d) => d.severity === 'info' && !d.acknowledged);
    const acknowledged = deadlines.filter((d) => d.acknowledged);

    return successResponse({
      deadlines,
      summary: {
        total: deadlines.length,
        critical: critical.length,
        warning: warning.length,
        info: info.length,
        acknowledged: acknowledged.length,
      },
      grouped: {
        critical,
        warning,
        info,
        acknowledged,
      },
    });
  } catch (error) {
    log.logError('Error fetching deadlines', error);
    return errorResponse('Failed to fetch deadlines', 500);
  }
});
