import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { acknowledgeAlert, snoozeAlert } from '@/lib/deadline';
import { standardRateLimiter } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:deadlines-alert');

interface RouteParams {
  params: Promise<{ alertId: string }>;
}

/**
 * PATCH /api/cases/deadlines/[alertId]
 *
 * Update a deadline alert (acknowledge or snooze).
 *
 * Body:
 * - action: 'acknowledge' | 'snooze'
 * - snoozeDays: number (optional, default 1, only for snooze action)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { alertId } = await params;

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

    // Rate limit check
    const rateLimitResult = await standardRateLimiter.limit(request, user.id);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse request body
    const parsed = await safeParseBody(request);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;
    const { action, snoozeDays = 1 } = body as {
      action: 'acknowledge' | 'snooze';
      snoozeDays?: number;
    };

    if (!action || !['acknowledge', 'snooze'].includes(action)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid action. Must be "acknowledge" or "snooze"' },
        { status: 400 }
      );
    }

    // Perform action
    let success = false;
    if (action === 'acknowledge') {
      success = await acknowledgeAlert(alertId, user.id);
    } else if (action === 'snooze') {
      const validSnoozeDays = Math.min(Math.max(snoozeDays, 1), 30);
      success = await snoozeAlert(alertId, user.id, validSnoozeDays);
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Alert not found or you do not have access' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      alertId,
    });
  } catch (error) {
    log.logError('Error updating deadline alert', error);

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update alert' },
      { status: 500 }
    );
  }
}
