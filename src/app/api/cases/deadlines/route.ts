import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUpcomingDeadlines } from '@/lib/deadline';

/**
 * GET /api/cases/deadlines
 *
 * Get upcoming deadlines for the authenticated user.
 *
 * Query params:
 * - days: Number of days to look ahead (default 60)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to continue' },
        { status: 401 }
      );
    }

    // Parse query params
    const days = parseInt(request.nextUrl.searchParams.get('days') || '60', 10);
    const validDays = Math.min(Math.max(days, 1), 365);

    // Get upcoming deadlines
    const deadlines = await getUpcomingDeadlines(user.id, validDays);

    // Group by severity
    const critical = deadlines.filter((d) => d.severity === 'critical' && !d.acknowledged);
    const warning = deadlines.filter((d) => d.severity === 'warning' && !d.acknowledged);
    const info = deadlines.filter((d) => d.severity === 'info' && !d.acknowledged);
    const acknowledged = deadlines.filter((d) => d.acknowledged);

    return NextResponse.json({
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
    console.error('Error fetching deadlines:', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch deadlines' },
      { status: 500 }
    );
  }
}
