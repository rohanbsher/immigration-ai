import { acknowledgeAlert, snoozeAlert } from '@/lib/deadline';
import { createLogger } from '@/lib/logger';
import { withAuth, successResponse, errorResponse, safeParseBody } from '@/lib/auth/api-helpers';

const log = createLogger('api:deadlines-alert');

/**
 * PATCH /api/cases/deadlines/[alertId]
 *
 * Update a deadline alert (acknowledge or snooze).
 *
 * Body:
 * - action: 'acknowledge' | 'snooze'
 * - snoozeDays: number (optional, default 1, only for snooze action)
 */
export const PATCH = withAuth(async (request, context, auth) => {
  const { alertId } = await context.params!;

  // Parse request body
  const parsed = await safeParseBody(request);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const { action, snoozeDays = 1 } = body as {
    action: 'acknowledge' | 'snooze';
    snoozeDays?: number;
  };

  if (!action || !['acknowledge', 'snooze'].includes(action)) {
    return errorResponse('Invalid action. Must be "acknowledge" or "snooze"', 400);
  }

  // Perform action
  let success = false;
  if (action === 'acknowledge') {
    success = await acknowledgeAlert(alertId, auth.user.id);
  } else if (action === 'snooze') {
    const validSnoozeDays = Math.min(Math.max(snoozeDays, 1), 30);
    success = await snoozeAlert(alertId, auth.user.id, validSnoozeDays);
  }

  if (!success) {
    return errorResponse('Alert not found or you do not have access', 404);
  }

  return successResponse({
    action,
    alertId,
  });
}, { rateLimit: 'STANDARD' });
